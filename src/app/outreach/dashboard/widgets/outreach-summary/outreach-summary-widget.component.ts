import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ZardCardComponent } from '@/shared/components/card';

@Component({
  selector: 'app-outreach-summary-widget',
  standalone: true,
  imports: [
    CommonModule, 
    ZardIconComponent,
    ZardTableComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-bold text-gray-800">Outreach Dynamics</h2>
        </div>

        <!-- Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8 animate-fadeIn">
            <button *ngFor="let item of (facade.outreachActions$ | async); let i = index; trackBy: trackByLabel" 
                (click)="facade.selectActionTab(i)"
                type="button"
                class="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 rounded-3xl transition-transform hover:scale-[1.01]">
                <z-card 
                  [label]="item.label" 
                  [count]="item.count" 
                  [isSelected]="i === ((facade.selectedActionTab$ | async) ?? 0)">
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
                        <ng-container *ngIf="(facade.dynamicsTableData$ | async) as records; else loadingTable">
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
                <ng-container *ngIf="{ page: facade.currentPage$ | async, total: facade.totalDynamicsRecords$ | async } as state">
                    <span class="text-xs font-medium text-gray-500">
                        Showing {{ state.total ? ((state.page || 0) * 10) + 1 : 0 }} - {{ Math.min(((state.page || 0) + 1) * 10, state.total || 0) }} of {{ state.total || 0 }} results
                    </span>
                    <div class="flex items-center gap-2">
                        <button (click)="facade.prevPage()" [disabled]="!state.page" 
                            class="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                        <button (click)="facade.nextPage()" [disabled]="(((state.page || 0) + 1) * 10) >= (state.total || 0)"
                            class="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
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


}
