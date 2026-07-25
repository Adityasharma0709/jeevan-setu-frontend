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
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';
import { ZardCardComponent } from '@/shared/components/card';

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
    ZardTableCellComponent,
    ZardPaginationComponent,
    ZardCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-8 pt-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
             <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100/50">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">Activity / Sessions</h2>
                        <p class="text-xs text-gray-400 font-semibold mt-0.5">Filter and view outreach counts by activity categories</p>
                    </div>
                    <button type="button" 
                      (click)="facade.toggleUniqueCount()" 
                      [class]="(facade.uniqueCount$ | async) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                      class="px-4 py-2.5 text-xs font-bold border rounded-xl flex items-center gap-2 transition-all shadow-sm">
                      <z-icon [zType]="(facade.uniqueCount$ | async) ? 'circle-check' : 'square'" class="w-4 h-4"></z-icon>
                      Unique Beneficiaries Count
                    </button>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex flex-col gap-1 w-44">
                        <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Activity</label>
                        <z-combobox [options]="(facade.activityOptions$ | async) || []" [formControl]="facade.activityFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Activity..." class="w-full"></z-combobox>
                    </div>
                    <div class="flex flex-col gap-1 w-44">
                        <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Session</label>
                        <z-combobox [options]="(facade.sessionOptions$ | async) || []" [formControl]="facade.sessionFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Session..." class="w-full"></z-combobox>
                    </div>
                </div>
             </div>

            <!-- Clickable Cards Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8 animate-fadeIn">
                <button *ngFor="let item of (facade.activities$ | async); let i = index; trackBy: trackByLabel" 
                    (click)="facade.selectActivityTab(i)"
                    type="button"
                    class="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 rounded-3xl transition-transform hover:scale-[1.01]">
                    <z-card 
                      [label]="item.label" 
                      [count]="item.count" 
                      [isSelected]="i === ((facade.selectedActivityTab$ | async) ?? 0)">
                    </z-card>
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
                                <th *ngIf="(facade.selectedActivityTab$ | async) === 5" z-table-head class="w-48 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Child Name & Age</span></th>
                                <th z-table-head class="w-24 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Age</span></th>
                                <th z-table-head class="w-36 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Group</span></th>
                                <th z-table-head class="w-32 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">AWC</span></th>
                                <th z-table-head class="w-36 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Activity</span></th>
                                <th z-table-head class="w-32 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Session</span></th>
                                <th z-table-head class="w-28 border-b border-slate-300 px-2 py-1.5 cursor-pointer select-none"><span class="flex flex-col items-center justify-center gap-1">Date</span></th>
                            </tr>
                        </thead>
                        <tbody z-table-body class="divide-y divide-slate-100 text-[13px]" *ngIf="{ page: facade.currentActivityPage$ | async, total: facade.totalActivityRecords$ | async } as state">
                            <ng-container *ngIf="(facade.activityTableData$ | async) as records; else loadingTable">
                                <tr z-table-row *ngFor="let row of records; let idx = index" class="align-top hover:bg-slate-50 transition-colors">
                                    <td z-table-cell class="px-2 py-3 text-center font-semibold text-slate-700">
                                      {{ ((state.page || 0) * 10) + idx + 1 }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3 font-mono text-[12px] text-slate-600">
                                      {{ row.id || '-' }}
                                    </td>
                                    <td z-table-cell class="px-2 py-3">
                                      <span class="block font-semibold text-slate-900">
                                        {{ row.name || 'Unknown' }}
                                      </span>
                                    </td>
                                    <td *ngIf="(facade.selectedActivityTab$ | async) === 5" z-table-cell class="px-2 py-3 text-slate-700">
                                      {{ row.childNameAndAge || '-' }}
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
                    <ng-container *ngIf="{ page: facade.currentActivityPage$ | async, total: facade.totalActivityRecords$ | async } as state">
                        <span class="text-xs font-medium text-gray-500">
                            Showing {{ state.total ? ((state.page || 0) * 10) + 1 : 0 }} - {{ Math.min(((state.page || 0) + 1) * 10, state.total || 0) }} of {{ state.total || 0 }} results
                        </span>
                        <div class="flex items-center gap-2">
                            <z-pagination
                              [zPageIndex]="(state.page || 0) + 1"
                              (zPageIndexChange)="facade.goToActivityPage($event - 1)"
                              [zTotal]="Math.ceil((state.total || 0) / 10)"
                              [zSize]="'sm'"
                            ></z-pagination>
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


}
