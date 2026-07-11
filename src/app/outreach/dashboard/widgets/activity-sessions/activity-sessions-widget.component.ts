import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { ZardIconComponent, type ZardIcon } from '@/shared/components/icon';
import {
  ZardTableComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { DashboardFacade } from '../../dashboard.facade';

@Component({
  selector: 'app-activity-sessions-widget',
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
    ZardTableCellComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-8 pt-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
             <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100/50">
                <div class="flex items-center gap-3">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">Activity / Sessions</h2>
                        <p class="text-xs text-gray-400 font-semibold mt-0.5">Filter and view outreach counts by activity categories</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex flex-col gap-1 w-44">
                        <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Activity</label>
                        <z-combobox [options]="(facade.activityOptions$ | async) || []" [formControl]="facade.activityFilter" zWidth="full" [searchable]="false" class="w-full"></z-combobox>
                    </div>
                    <div class="flex flex-col gap-1 w-44">
                        <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Session</label>
                        <z-combobox [options]="(facade.sessionOptions$ | async) || []" [formControl]="facade.sessionFilter" zWidth="full" [searchable]="false" class="w-full"></z-combobox>
                    </div>
                </div>
            </div>

            <!-- Clickable Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                <button *ngFor="let item of (facade.activities$ | async); let i = index; trackBy: trackByLabel" 
                    (click)="facade.selectActivityTab(i)"
                    [class]="getCardClass(item, i === ((facade.selectedActivityTab$ | async) ?? 0))"
                    type="button">
                    
                    <!-- Icon container -->
                    <div [class]="'w-10 h-10 rounded-full flex items-center justify-center shadow-inner mb-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ' + 
                        (i === ((facade.selectedActivityTab$ | async) ?? 0) ? 'bg-white/95' : 'bg-white/85')">
                        <z-icon [zType]="getActivityIcon(item)" class="w-5 h-5 opacity-90"></z-icon>
                    </div>
                    
                    <!-- Count -->
                    <h3 class="text-3xl md:text-4xl font-black mb-2 tracking-tight">{{item.count}}</h3>
                    
                    <!-- Label -->
                    <p class="text-[10px] font-extrabold uppercase tracking-widest leading-snug opacity-80 mb-0">{{item.label}}</p>
                </button>
            </div>

            <!-- Details Table Layout -->
            <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mt-8">
                <div class="overflow-x-auto min-h-[300px]">
                    <table z-table class="w-full text-left border-collapse whitespace-nowrap">
                        <thead class="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th z-table-head class="w-16 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex items-center justify-center gap-1">#</span></th>
                                <th z-table-head class="w-32 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Beneficiary ID</span></th>
                                <th z-table-head class="w-48 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Beneficiary Name</span></th>
                                <th z-table-head class="w-24 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Age</span></th>
                                <th z-table-head class="w-36 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Group</span></th>
                                <th z-table-head class="w-32 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">AWC</span></th>
                                <th z-table-head class="w-36 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Activity</span></th>
                                <th z-table-head class="w-32 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Session</span></th>
                                <th z-table-head class="w-28 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Date</span></th>
                            </tr>
                        </thead>
                        <tbody z-table-body class="divide-y divide-slate-100 text-[13px]">
                            <ng-container *ngIf="(facade.activityTableData$ | async) as records; else loadingTable">
                                <tr z-table-row *ngFor="let row of records; let i = index" class="align-top hover:bg-slate-50 transition-colors">
                                    <td z-table-cell class="px-2 py-3 text-center font-semibold text-slate-700">
                                      {{ i + 1 }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 font-mono text-[12px] text-slate-600">
                                      {{ row.id || '-' }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3">
                                      <span class="block font-semibold text-slate-900">
                                        {{ row.name || 'Unknown' }}
                                      </span>
                                    </td>
                                    <td z-table-cell class="px-2 py-3 text-slate-700">
                                      {{ row.age || '-' }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 font-medium text-slate-700">
                                      {{ row.group }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 text-slate-700">
                                      {{ row.awc }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 text-slate-700">
                                      {{ row.activity || '-' }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 text-slate-700">
                                      {{ row.session || '-' }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 whitespace-nowrap text-slate-700">
                                      {{ row.reportingDate }}
                                    </td>
                                </tr>
                                <tr z-table-row *ngIf="records.length === 0">
                                    <td z-table-cell colspan="9" class="px-4 py-12 text-center text-sm font-semibold italic text-slate-500">
                                        No reports found for this group.
                                    </td>
                                </tr>
                            </ng-container>
                            <ng-template #loadingTable>
                                <tr z-table-row>
                                    <td z-table-cell colspan="9" class="px-4 py-8 text-center text-gray-500">
                                        <z-icon zType="loader-circle" class="w-6 h-6 animate-spin mx-auto text-blue-500"></z-icon>
                                        <p class="mt-2 font-medium text-sm">Loading records...</p>
                                    </td>
                                </tr>
                            </ng-template>
                        </tbody>
                    </table>
                </div>
                <div class="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                    <ng-container *ngIf="{ page: facade.currentActivityPage$ | async, total: facade.totalActivityRecords$ | async } as state">
                        <span class="text-xs font-medium text-gray-500">
                            Showing {{ state.total ? ((state.page || 0) * 10) + 1 : 0 }} - {{ Math.min(((state.page || 0) + 1) * 10, state.total || 0) }} of {{ state.total || 0 }} results
                        </span>
                        <div class="flex items-center gap-2">
                            <button (click)="facade.activityPrevPage()" [disabled]="!state.page" 
                                class="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                            <button (click)="facade.activityNextPage()" [disabled]="(((state.page || 0) + 1) * 10) >= (state.total || 0)"
                                class="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                        </div>
                    </ng-container>
                </div>
            </div>
        </div>
    </div>
  `
})
export class ActivitySessionsWidgetComponent {
  facade = inject(DashboardFacade);
  Math = Math;

  trackByLabel(index: number, item: any): string {
    return item.label;
  }

  getActivityIcon(item: any): ZardIcon {
    const l = (item.label || '').toUpperCase();
    if (l.includes('STAKEHOLDER')) return 'users';
    if (l.includes('SAM') || l.includes('MAM')) return 'circle-alert';
    if (l.includes('PREGNANT') || l.includes('LACTATING') || l.includes('MARRIED')) return 'heart';
    return 'user';
  }

  getCardClass(item: any, isSelected: boolean): string {
    const l = (item.label || '').toUpperCase();
    let colorClasses = '';
    
    if (l.includes('SAM')) {
      colorClasses = isSelected
        ? 'bg-red-100/80 text-red-800 border-red-500 ring-4 ring-red-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100/50 hover:border-red-300';
    } else if (l.includes('MAM')) {
      colorClasses = isSelected
        ? 'bg-green-100/80 text-green-800 border-green-500 ring-4 ring-green-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100/50 hover:border-green-300';
    } else if (l.includes('PREGNANT') || l.includes('LACTATING') || l.includes('MARRIED')) {
      colorClasses = isSelected
        ? 'bg-pink-100/80 text-pink-800 border-pink-500 ring-4 ring-pink-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100/50 hover:border-pink-300';
    } else if (l.includes('STAKEHOLDER')) {
      colorClasses = isSelected
        ? 'bg-indigo-100/80 text-indigo-800 border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50 hover:border-indigo-300';
    } else if (l.includes('BOYS')) {
      colorClasses = isSelected
        ? 'bg-sky-100/80 text-sky-800 border-sky-500 ring-4 ring-sky-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100/50 hover:border-sky-300';
    } else if (l.includes('GIRLS')) {
      colorClasses = isSelected
        ? 'bg-rose-100/80 text-rose-800 border-rose-500 ring-4 ring-rose-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50 hover:border-rose-300';
    } else {
      colorClasses = isSelected
        ? 'bg-slate-100 text-slate-800 border-slate-500 ring-4 ring-slate-500/20 scale-[1.02] shadow-md font-bold'
        : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100/50 hover:border-slate-300';
    }

    return `w-full text-center border rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 h-full group focus:outline-none cursor-pointer ${colorClasses}`;
  }
}
