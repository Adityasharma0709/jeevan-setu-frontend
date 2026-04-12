import re

with open('src/app/super-admin/locations/locations.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    '''  locationSearch = new FormControl('');\n  statusFilter = new FormControl<LocationStatusFilter>('ALL');''',
    '''  locationSearch = new FormControl('');\n  statusFilter = new FormControl<LocationStatusFilter>('ALL');\n  projectSearchInput = new FormControl('');\n\n  filteredProjects$!: Observable<ProjectModel[]>;'''
)

code = code.replace(
    '''    this.projects$ = (this.api.get('projects') as Observable<ProjectModel[]>).pipe(
      map((projects) =>
        (projects || []).filter(
          (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );''',
    '''    this.projects$ = (this.api.get('projects') as Observable<ProjectModel[]>).pipe(
      map((projects) =>
        (projects || []).filter(
          (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.filteredProjects$ = combineLatest([
      this.projects$,
      this.projectSearchInput.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([projects, search]) => {
        if (!search) return projects;
        const lower = search.toLowerCase();
        return projects.filter((p) => {
          const name = (p?.name || '').toString().toLowerCase();
          return name.includes(lower);
        });
      })
    );'''
)

code = code.replace(
    '''    this.assignProjectLoading.set(false);\n    this.assignProjectForm.reset({\n      projectId: location.projectId ?? null,\n    });''',
    '''    this.assignProjectLoading.set(false);\n    this.assignProjectForm.reset({\n      projectId: location.projectId ?? null,\n    });\n    this.projectSearchInput.reset();'''
)

code = code.replace(
    '''zTitle: `Assign Project: ${location.locationCode}`,''',
    '''zTitle: `Assign Project`,'''
)

code = code.replace(
    '''zOnCancel: () => {\n        this.targetLocation = null;\n        this.assignProjectLoading.set(false);\n        this.assignProjectForm.reset();\n      },''',
    '''zOnCancel: () => {\n        this.targetLocation = null;\n        this.assignProjectLoading.set(false);\n        this.assignProjectForm.reset();\n        this.projectSearchInput.reset();\n      },'''
)

code = code.replace(
    '''        this.assignProjectLoading.set(false);\n        this.targetLocation = null;\n        this.assignProjectForm.reset();\n        this.refresh$.next();\n        this.dialogRef?.close();''',
    '''        this.assignProjectLoading.set(false);\n        this.targetLocation = null;\n        this.assignProjectForm.reset();\n        this.projectSearchInput.reset();\n        this.refresh$.next();\n        this.dialogRef?.close();'''
)

with open('src/app/super-admin/locations/locations.ts', 'w', encoding='utf-8') as f:
    f.write(code)
