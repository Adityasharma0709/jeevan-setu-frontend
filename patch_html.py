import re

with open('src/app/super-admin/locations/locations.html', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    '''      <z-form-control>
        <select z-input formControlName="projectId">
          <option [ngValue]="null">No Project</option>
          <option *ngFor="let p of projects$ | async" [ngValue]="p.id">
            {{ p.name }}
          </option>
        </select>
      </z-form-control>''',
    '''      <z-form-control class="flex flex-col gap-2">
        <input z-input type="text" [formControl]="projectSearchInput" placeholder="Search project name..." class="w-full text-sm" />
        <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
          <ng-container *ngIf="filteredProjects$ | async as projects">
            <button type="button"
                    (click)="assignProjectForm.get('projectId')?.setValue(null)"
                    [class.bg-gray-100]="assignProjectForm.get('projectId')?.value === null"
                    [class.font-medium]="assignProjectForm.get('projectId')?.value === null"
                    class="w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none transition-colors">
              No Project
            </button>
            <div *ngIf="!projects.length" class="p-4 text-sm text-gray-500 text-center">
              No projects found
            </div>
            <button *ngFor="let p of projects" 
                    type="button" 
                    (click)="assignProjectForm.get('projectId')?.setValue(p.id)"
                    [class.bg-gray-100]="assignProjectForm.get('projectId')?.value === p.id"
                    [class.font-medium]="assignProjectForm.get('projectId')?.value === p.id"
                    class="w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none transition-colors">
              {{ p.name }}
            </button>
          </ng-container>
        </div>
      </z-form-control>'''
)

with open('src/app/super-admin/locations/locations.html', 'w', encoding='utf-8') as f:
    f.write(code)
