import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import {
  ZardTableComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';
import { ZardCardComponent } from '@/shared/components/card';

@Component({
  selector: 'z-outreach-dynamics',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardIconComponent,
    ZardComboboxComponent,
    ZardTableComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardPaginationComponent,
    ZardCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-bold text-gray-800">Outreach Dynamics</h2>
        </div>

        <!-- Cascading Hierarchy Filters -->
        <div *ngIf="showHierarchyFilters" class="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ADMIN</label>
                <z-combobox *ngIf="adminFilter" [options]="adminOptions" [formControl]="adminFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Admin..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MANAGER</label>
                <z-combobox *ngIf="managerFilter" [options]="managerOptions" [formControl]="managerFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Manager..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-56">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OUTREACH WORKER</label>
                <z-combobox *ngIf="workerFilter" [options]="workerOptions" [formControl]="workerFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Worker..." class="w-full"></z-combobox>
            </div>
        </div>

        <!-- Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8 animate-fadeIn">
            <button *ngFor="let item of actions; let i = index; trackBy: trackByLabel" 
                (click)="tabChange.emit(i)"
                type="button"
                class="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 rounded-3xl transition-transform hover:scale-[1.01]">
                <z-card 
                  [label]="item.label" 
                  [count]="item.count" 
                  [isSelected]="i === selectedTab"
                  [trend]="getTrendText(item)"
                  [trendValue]="getTrendValue(item)"
                  [trendType]="getTrendType(item)">
                </z-card>
            </button>
        </div>

        <!-- Dynamic Table Layout -->
        <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mt-6">
            <div class="overflow-x-auto min-h-[300px]">
                <table z-table class="w-full text-left border-collapse whitespace-nowrap">
                    <thead class="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th z-table-head class="w-16 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex items-center justify-center gap-1">#</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Beneficiary ID</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Name</span></th>
                            <th *ngIf="selectedTab === 1" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Child Name & Age</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Age</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Group</span></th>
                            
                            <!-- Analyst Columns -->
                            <th *ngIf="role === 'analyst'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Gender</span></th>
                            <th *ngIf="role === 'analyst'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Guardian Name</span></th>
                            <th *ngIf="role === 'analyst'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Location</span></th>
                            <th *ngIf="role === 'analyst'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Project</span></th>
                            <th *ngIf="role === 'analyst'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Beneficiary Type</span></th>

                            <!-- Outreach Columns -->
                            <th *ngIf="role === 'outreach'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">AWC</span></th>
                            <th *ngIf="role === 'outreach'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Activity</span></th>
                            <th *ngIf="role === 'outreach'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Session</span></th>
                            <th *ngIf="role === 'outreach'" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Date</span></th>
                        </tr>
                    </thead>
                    <tbody z-table-body class="divide-y divide-slate-100 text-[13px]" *ngIf="{ page: page, total: totalRecords } as state">
                        <ng-container *ngIf="records as dataRecords; else loadingTable">
                            <tr z-table-row *ngFor="let row of dataRecords; let idx = index" 
                                class="align-top hover:bg-slate-50 transition-colors">
                                <td z-table-cell class="px-2 py-3 text-center font-semibold">
                                  {{ (state.page * 10) + idx + 1 }}
                                </td>
                                <td z-table-cell 
                                    (click)="row.benId && beneficiaryClick.emit(row.benId)" 
                                    [class.cursor-pointer]="row.benId"
                                    [class.underline]="row.benId"
                                    [class.hover:text-blue-800]="row.benId"
                                    class="px-3 py-3 font-mono text-[12px] text-blue-600 select-none"
                                    [title]="row.benId ? 'Click to view profile detail' : ''">
                                  {{ row.id }}
                                </td>
                                <td z-table-cell class="px-3 py-3 font-bold text-slate-800">
                                  {{ row.name }}
                                </td>
                                <td *ngIf="selectedTab === 1" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.childNameAndAge || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.age || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 font-medium text-slate-700">
                                  {{ row.group }}
                                </td>

                                <!-- Analyst Fields -->
                                <td *ngIf="role === 'analyst'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.gender || '-' }}
                                </td>
                                <td *ngIf="role === 'analyst'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.guardianName || '-' }}
                                </td>
                                <td *ngIf="role === 'analyst'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.awc }}
                                </td>
                                <td *ngIf="role === 'analyst'" z-table-cell class="px-3 py-3 font-semibold text-slate-800">
                                  {{ row.project || '-' }}
                                </td>
                                <td *ngIf="role === 'analyst'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.beneficiaryType || '-' }}
                                </td>

                                <!-- Outreach Fields -->
                                <td *ngIf="role === 'outreach'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.awc }}
                                </td>
                                <td *ngIf="role === 'outreach'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.activity || '-' }}
                                </td>
                                <td *ngIf="role === 'outreach'" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.session || '-' }}
                                </td>
                                <td *ngIf="role === 'outreach'" z-table-cell class="px-3 py-3 whitespace-nowrap text-slate-700">
                                  {{ row.reportingDate }}
                                </td>
                            </tr>
                            <tr z-table-row *ngIf="dataRecords.length === 0">
                                <td z-table-cell colspan="10" class="px-4 py-12 text-center text-sm font-semibold italic text-slate-500">
                                    No reports found for this group.
                                </td>
                            </tr>
                        </ng-container>
                        <ng-template #loadingTable>
                            <tr z-table-row>
                                <td z-table-cell colspan="10" class="px-4 py-8 text-center text-gray-500">
                                    <z-icon zType="loader-circle" class="w-6 h-6 animate-spin mx-auto text-blue-500"></z-icon>
                                    <p class="mt-2 font-medium text-sm">Loading records...</p>
                                </td>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            </div>
            <div class="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <ng-container *ngIf="{ page: page, total: totalRecords } as state">
                    <span class="text-xs font-medium text-gray-500">
                        Showing {{ state.total ? (state.page * 10) + 1 : 0 }} - {{ Math.min((state.page + 1) * 10, state.total || 0) }} of {{ state.total || 0 }} results
                    </span>
                    <div class="flex items-center gap-2">
                        <z-pagination
                          [zPageIndex]="state.page + 1"
                          (zPageIndexChange)="pageChange.emit($event - 1)"
                          [zTotal]="Math.ceil((state.total || 0) / 10)"
                          [zSize]="'sm'"
                        ></z-pagination>
                    </div>
                </ng-container>
            </div>
        </div>
    </div>
  `
})
export class OutreachDynamicsComponent {
  @Input() role: 'analyst' | 'outreach' = 'outreach';
  @Input() actions: any[] = [];
  @Input() selectedTab: number = 0;
  @Input() records: any[] | null = null;
  @Input() page: number = 0;
  @Input() totalRecords: number = 0;

  // Cascading Hierarchy Filters (Optional)
  @Input() showHierarchyFilters: boolean = false;
  @Input() adminOptions: any[] = [];
  @Input() managerOptions: any[] = [];
  @Input() workerOptions: any[] = [];
  @Input() adminFilter?: FormControl;
  @Input() managerFilter?: FormControl;
  @Input() workerFilter?: FormControl;

  @Output() tabChange = new EventEmitter<number>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() beneficiaryClick = new EventEmitter<number>();

  Math = Math;

  trackByLabel(index: number, item: any): string {
    return item.label;
  }

  getTrendText(item: any): string {
    const l = (item.label || '').toUpperCase();
    if (l.includes('PREGNANT')) return 'Increased from last month';
    if (l.includes('LACTATING')) return 'Increased from last month';
    if (l.includes('SAM')) return 'Needs critical attention';
    if (l.includes('ADOLESCENT')) return 'Registered this month';
    if (l.includes('EBF')) return 'Increased from last month';
    if (l.includes('CF PROMOTION')) return 'Increased from last month';
    if (l.includes('MAM')) return 'Needs monitoring';
    if (l.includes('DELIVERY') || l.includes('30 DAYS')) return 'Deliveries scheduled';
    return 'Active status';
  }

  getTrendValue(item: any): string {
    const l = (item.label || '').toUpperCase();
    if (l.includes('PREGNANT')) return '5 ▲';
    if (l.includes('LACTATING')) return '6 ▲';
    if (l.includes('SAM')) return 'Critical';
    if (l.includes('ADOLESCENT')) return '12 ▲';
    if (l.includes('EBF')) return '10 ▲';
    if (l.includes('CF PROMOTION')) return '8 ▲';
    if (l.includes('MAM')) return 'Warning';
    if (l.includes('DELIVERY') || l.includes('30 DAYS')) return 'Urgent';
    return 'OK';
  }

  getTrendType(item: any): 'success' | 'danger' | 'info' | 'neutral' {
    const l = (item.label || '').toUpperCase();
    if (l.includes('SAM') || l.includes('MAM') || l.includes('DELIVERY') || l.includes('30 DAYS')) {
      return 'danger';
    }
    if (l.includes('ADOLESCENT')) {
      return 'info';
    }
    return 'success';
  }
}
