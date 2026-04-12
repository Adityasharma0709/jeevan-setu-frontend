with open('src/app/super-admin/locations/locations.html', 'r', encoding='utf-8') as f:
    code = f.read()

old = '''        <h3 class="font-semibold">
          {{ l.locationCode }} \u2013 {{ l.project?.name }}
        </h3>'''

new = '''        <h3 class="font-semibold">{{ l.locationCode }}</h3>

        <div class="flex items-center gap-1 mt-0.5">
          <span class="text-xs text-gray-500">Project:</span>
          <span *ngIf="l.project?.name; else mobileNoProject"
            class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            {{ l.project?.name }}
          </span>
          <ng-template #mobileNoProject>
            <span class="text-xs text-gray-400 italic">None</span>
          </ng-template>
        </div>'''

# Try replacing the exact bytes
import re
code2 = re.sub(
    r'<h3 class="font-semibold">\s*\{\{ l\.locationCode \}\}[^<]*<\/h3>',
    new,
    code,
    flags=re.DOTALL
)

if code2 == code:
    print("No replacement made - pattern not found")
else:
    print("Replacement successful")
    with open('src/app/super-admin/locations/locations.html', 'w', encoding='utf-8') as f:
        f.write(code2)
