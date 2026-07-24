import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { ZardIconComponent } from '@/shared/components/icon';
import {
  ZardTableComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { DashboardFacade } from '../../dashboard.facade';
import { OutreachAction } from '../../models/dashboard.types';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-outreach-summary-widget',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    ZardComboboxComponent,
    ZardIconComponent,
    ZardTableComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardPaginationComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-bold text-gray-800">Outreach Dynamics</h2>
        </div>

        <!-- Cascading Hierarchy Filters -->
        <div class="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ADMIN</label>
                <z-combobox [options]="(facade.adminOptions$ | async) || []" [formControl]="facade.adminFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Admin..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MANAGER</label>
                <z-combobox [options]="(facade.managerOptions$ | async) || []" [formControl]="facade.managerFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Manager..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-56">
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OUTREACH WORKER</label>
                <z-combobox [options]="(facade.workerOptions$ | async) || []" [formControl]="facade.workerFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Worker..." class="w-full"></z-combobox>
            </div>
        </div>

        <!-- Cards Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
            <button *ngFor="let item of (facade.outreachActions$ | async); let i = index; trackBy: trackByLabel" 
                (click)="facade.selectActionTab(i)"
                [class]="getCardClass(item, i === ((facade.selectedActionTab$ | async) ?? 0))"
                type="button">
                <h3 class="text-3xl md:text-4xl font-black mb-2 tracking-tight">{{item.count}}</h3>
                <p class="text-[10px] font-extrabold uppercase tracking-wide leading-snug opacity-80 mb-0">{{item.label}}</p>
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
                            <th *ngIf="(facade.selectedActionTab$ | async) === 1" z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Child Name & Age</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Age</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Gender</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Guardian Name</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Location</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Project</span></th>
                            <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Reporting Date</span></th>
                        </tr>
                    </thead>
                    <tbody z-table-body class="divide-y divide-slate-100 text-[13px]" *ngIf="{ page: facade.currentPage$ | async, total: facade.totalDynamicsRecords$ | async } as state">
                        <ng-container *ngIf="(facade.dynamicsTableData$ | async) as records; else loadingTable">
                            <tr z-table-row *ngFor="let row of records; let idx = index" class="align-top hover:bg-slate-50 transition-colors">
                                <td z-table-cell class="px-2 py-3 text-center font-semibold">
                                  {{ ((state.page || 0) * 10) + idx + 1 }}
                                </td>
                                <td z-table-cell class="px-3 py-3 font-mono text-[12px] text-blue-600">
                                  {{ row.id }}
                                </td>
                                <td z-table-cell class="px-3 py-3 font-bold text-slate-800">
                                  {{ row.name }}
                                </td>
                                <td *ngIf="(facade.selectedActionTab$ | async) === 1" z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.childNameAndAge || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.age || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.gender || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.guardianName || '-' }}
                                </td>
                                <td z-table-cell class="px-3 py-3 text-slate-700">
                                  {{ row.awc }}
                                </td>
                                <td z-table-cell class="px-3 py-3 font-semibold text-slate-800">
                                  {{ row.project || '-' }}
                                </td>
                                <td z-table-cell class="px-2 py-3 whitespace-nowrap text-slate-700">
                                  {{ row.reportingDate }}
                                </td>
                            </tr>
                            <tr z-table-row *ngIf="records.length === 0">
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
                <ng-container *ngIf="{ page: facade.currentPage$ | async, total: facade.totalDynamicsRecords$ | async } as state">
                    <span class="text-xs font-medium text-gray-500">
                        Showing {{ state.total ? ((state.page || 0) * 10) + 1 : 0 }} - {{ Math.min(((state.page || 0) + 1) * 10, state.total || 0) }} of {{ state.total || 0 }} results
                    </span>
                    <div class="flex items-center gap-2">
                        <z-pagination
                          [zPageIndex]="(state.page || 0) + 1"
                          (zPageIndexChange)="facade.goToPage($event - 1)"
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
export class OutreachSummaryWidgetComponent {
  facade = inject(DashboardFacade);
  Math = Math;

  trackByLabel(index: number, item: any): string {
    return item.label;
  }

  getCardClass(item: OutreachAction, isSelected: boolean): string {
    const l = (item.label || '').toUpperCase();
    let colorClasses = '';
    
    if (l.includes('PREGNANT')) {
      colorClasses = isSelected
        ? 'bg-pink-100/80 text-pink-800 border-pink-500 ring-4 ring-pink-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100/50 hover:border-pink-300';
    } else if (l.includes('LACTATING')) {
      colorClasses = isSelected
        ? 'bg-purple-100/80 text-purple-800 border-purple-500 ring-4 ring-purple-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100/50 hover:border-purple-300';
    } else if (l.includes('SAM')) {
      colorClasses = isSelected
        ? 'bg-red-100/80 text-red-800 border-red-500 ring-4 ring-red-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100/50 hover:border-red-300';
    } else if (l.includes('ADOLESCENT') || l.includes('GIRLS')) {
      colorClasses = isSelected
        ? 'bg-rose-100/80 text-rose-800 border-rose-500 ring-4 ring-rose-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50 hover:border-rose-300';
    } else if (l.includes('EBF')) {
      colorClasses = isSelected
        ? 'bg-emerald-100/80 text-emerald-800 border-emerald-500 ring-4 ring-emerald-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50 hover:border-emerald-300';
    } else if (l.includes('CF PROMOTION')) {
      colorClasses = isSelected
        ? 'bg-sky-100/80 text-sky-800 border-sky-500 ring-4 ring-sky-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100/50 hover:border-sky-300';
    } else if (l.includes('MAM')) {
      colorClasses = isSelected
        ? 'bg-yellow-100/80 text-yellow-800 border-yellow-500 ring-4 ring-yellow-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100/50 hover:border-yellow-300';
    } else if (l.includes('DELIVERY') || l.includes('30 DAYS')) {
      colorClasses = isSelected
        ? 'bg-indigo-100/80 text-indigo-800 border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50 hover:border-indigo-300';
    } else {
      colorClasses = isSelected
        ? 'bg-slate-100 text-slate-800 border-slate-500 ring-4 ring-slate-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100/50 hover:border-slate-300';
    }

    return `w-full text-center border rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 h-full group focus:outline-none cursor-pointer ${colorClasses}`;
  }
}
