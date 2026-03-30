param(
  [string]$BackendManagerControllerPath = (Resolve-Path "..\\backend\\src\\manager\\manager.controller.ts").Path,
  [string]$BackendManagerServicePath = (Resolve-Path "..\\backend\\src\\manager\\manager.service.ts").Path
)

$ErrorActionPreference = "Stop"

function Assert-FileExists([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { throw "File not found: $path" }
}

Assert-FileExists $BackendManagerControllerPath
Assert-FileExists $BackendManagerServicePath

$controller = Get-Content -Raw -LiteralPath $BackendManagerControllerPath
$service = Get-Content -Raw -LiteralPath $BackendManagerServicePath

if ($controller -notmatch "outreach-workers/:id/tag") {
  $insert = @'
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('MANAGER')
  @Get('projects/:projectId/locations')
  getAssignedLocationsForProject(@Param('projectId') projectId: string, @Req() req) {
    return this.managerService.getAssignedLocations(req.user.userId, +projectId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('MANAGER')
  @Post('outreach-workers/:id/tag')
  tagOutreachWorkerProjectLocation(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.managerService.tagWorkerProjectLocation(
      req.user.userId,
      +id,
      body?.projectId,
      body?.locationId
    );
  }

'@

  $getIndex = $controller.IndexOf("@Get('outreach-workers')")
  if ($getIndex -lt 0) {
    throw "Could not find @Get('outreach-workers') in manager.controller.ts"
  }

  $afterIndex = $controller.IndexOf("  @UseGuards", $getIndex + 1)
  if ($afterIndex -lt 0) {
    throw "Could not find insertion point after getOutreachWorkers() in manager.controller.ts"
  }

  $controller = $controller.Substring(0, $afterIndex) + $insert + $controller.Substring($afterIndex)
}

if ($service -notmatch "tagWorkerProjectLocation") {
  $start = $service.IndexOf("  async getOutreachWorkers(managerId: number) {")
  if ($start -lt 0) { throw "getOutreachWorkers() not found in manager.service.ts" }

  $next = $service.IndexOf("  async getProfileRequests()", $start)
  if ($next -lt 0) { throw "getProfileRequests() not found after getOutreachWorkers() in manager.service.ts" }

  $replacement = @'
  async getOutreachWorkers(managerId: number) {
    return this.prisma.user.findMany({
      where: {
        createdByAdminId: managerId,
        roles: {
          some: {
            role: { name: 'OUTREACH' }
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobileNumber: true,
        status: true,
        projectAssignments: {
          select: {
            projectId: true,
            locationId: true,
            project: { select: { id: true, name: true } },
            location: { select: { id: true, village: true, block: true, status: true } },
          }
        }
      },
      orderBy: { id: 'desc' }
    });
  }

  async getAssignedLocations(managerId: number, projectId: number) {
    const numericProjectId = Number(projectId);
    if (!Number.isFinite(numericProjectId)) {
      throw new BadRequestException('Invalid projectId');
    }

    const assignments = await this.prisma.userProjectLocation.findMany({
      where: { userId: managerId, projectId: numericProjectId },
      select: {
        location: { select: { id: true, state: true, district: true, block: true, village: true, status: true } },
      },
    });

    const seen = new Set<number>();
    return (assignments || [])
      .map((a: any) => a.location)
      .filter(Boolean)
      .filter((l: any) => (l.status ?? '').toString().toUpperCase() === 'ACTIVE')
      .filter((l: any) => {
        const id = Number(l.id);
        if (!Number.isFinite(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  async tagWorkerProjectLocation(managerId: number, workerId: number, projectId: any, locationId: any) {
    const numericWorkerId = Number(workerId);
    const numericProjectId = Number(projectId);
    const numericLocationId = Number(locationId);

    if (!Number.isFinite(numericWorkerId) || !Number.isFinite(numericProjectId) || !Number.isFinite(numericLocationId)) {
      throw new BadRequestException('Invalid project/location selection');
    }

    const managerAssigned = await this.prisma.userProjectLocation.findFirst({
      where: {
        userId: managerId,
        projectId: numericProjectId,
        locationId: numericLocationId,
      },
      select: { id: true },
    });

    if (!managerAssigned) {
      throw new ForbiddenException('You are not assigned to this project/location');
    }

    const worker = await this.prisma.user.findFirst({
      where: {
        id: numericWorkerId,
        createdByAdminId: managerId,
        roles: {
          some: {
            role: { name: 'OUTREACH' }
          }
        }
      },
      select: { id: true },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    const already = await this.prisma.userProjectLocation.findFirst({
      where: { userId: numericWorkerId, projectId: numericProjectId, locationId: numericLocationId },
      select: { id: true },
    });

    if (already) {
      return { message: 'Already tagged' };
    }

    const linked = await this.prisma.project.count({
      where: {
        id: numericProjectId,
        locations: { some: { id: numericLocationId } },
      },
    });

    if (linked === 0) {
      await this.prisma.project.update({
        where: { id: numericProjectId },
        data: { locations: { connect: { id: numericLocationId } } },
      });
    }

    await this.prisma.userProjectLocation.create({
      data: {
        userId: numericWorkerId,
        projectId: numericProjectId,
        locationId: numericLocationId,
      }
    });

    return { message: 'Tagged successfully' };
  }

'@

  $service = $service.Substring(0, $start) + $replacement + $service.Substring($next)
}

Set-Content -LiteralPath $BackendManagerControllerPath -Value $controller -Encoding UTF8
Set-Content -LiteralPath $BackendManagerServicePath -Value $service -Encoding UTF8

Write-Host "Patched backend files:"
Write-Host " - $BackendManagerControllerPath"
Write-Host " - $BackendManagerServicePath"
