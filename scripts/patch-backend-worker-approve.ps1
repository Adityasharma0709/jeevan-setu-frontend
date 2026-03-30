param(
  [string]$BackendAdminServicePath = (Resolve-Path "..\\backend\\src\\admin\\admin.service.ts").Path
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackendAdminServicePath)) {
  throw "File not found: $BackendAdminServicePath"
}

$text = Get-Content -Raw -LiteralPath $BackendAdminServicePath

$createReplacement = @'
    if (requestType === 'CREATE_WORKER') {
      const { name, email, password, mobile, mobileNumber, projectId, locationId } = payload || {};
      if (!name || !email || !password) {
        throw new BadRequestException('Invalid CREATE_WORKER payload');
      }

      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) throw new ConflictException('Email already exists');

      const normalizedMobile = mobileNumber ?? mobile;

      const hash = await bcrypt.hash(String(password), 10);
      const worker = await this.prisma.user.create({
        data: {
          name: String(name),
          email: String(email),
          ...(normalizedMobile ? { mobileNumber: String(normalizedMobile) } : {}),
          password: hash,
          status: 'ACTIVE',
          createdByAdminId: request.requestedById,
        },
      });

      const role = await this.prisma.role.findUnique({ where: { name: 'OUTREACH' } });
      if (!role) throw new NotFoundException('OUTREACH role not found');

      await this.prisma.userRole.create({
        data: {
          userId: worker.id,
          roleId: role.id,
        },
      });

      if (projectId && locationId) {
        const numericProjectId = Number(projectId);
        const numericLocationId = Number(locationId);
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
            userId: worker.id,
            projectId: numericProjectId,
            locationId: numericLocationId,
          },
        });
      } else if (projectId || locationId) {
        throw new BadRequestException('For worker assignment, provide both projectId and locationId');
      }
    }

    if (requestType === 'MODIFY_WORKER')
'@

$createStart = $text.IndexOf("    if (requestType === 'CREATE_WORKER') {")
$createEnd = $text.IndexOf("    if (requestType === 'MODIFY_WORKER') {", [Math]::Max(0, $createStart))
if ($createStart -lt 0 -or $createEnd -lt 0 -or $createEnd -le $createStart) {
  throw "CREATE_WORKER/MODIFY_WORKER markers not found"
}
$text = $text.Substring(0, $createStart) + $createReplacement + $text.Substring($createEnd)

$modifyReplacement = @'
    if (requestType === 'MODIFY_WORKER') {
      const { workerId, name, email, mobile, mobileNumber } = payload || {};
      if (!workerId) throw new BadRequestException('Invalid MODIFY_WORKER payload');

      const updates: any = {};
      if (name) updates.name = String(name);
      if (email) updates.email = String(email);
      const normalizedMobile = mobileNumber ?? mobile;
      if (normalizedMobile) updates.mobileNumber = String(normalizedMobile);

      if (updates.email) {
        const existing = await this.prisma.user.findFirst({
          where: {
            email: updates.email,
            NOT: { id: Number(workerId) },
          },
        });
        if (existing) throw new ConflictException('Email already exists');
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.user.update({
          where: { id: Number(workerId) },
          data: updates,
        });
      }
    }

    if (requestType === 'DEACTIVATE_WORKER')
'@

$modifyStart = $text.IndexOf("    if (requestType === 'MODIFY_WORKER') {")
$modifyEnd = $text.IndexOf("    if (requestType === 'DEACTIVATE_WORKER') {", [Math]::Max(0, $modifyStart))
if ($modifyStart -lt 0 -or $modifyEnd -lt 0 -or $modifyEnd -le $modifyStart) {
  throw "MODIFY_WORKER/DEACTIVATE_WORKER markers not found"
}
$text = $text.Substring(0, $modifyStart) + $modifyReplacement + $text.Substring($modifyEnd)

Set-Content -LiteralPath $BackendAdminServicePath -Value $text -Encoding UTF8
Write-Host "Patched backend file:" $BackendAdminServicePath
