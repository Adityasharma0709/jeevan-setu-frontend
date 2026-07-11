import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
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
    ZardTableCellComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-bold text-gray-800">Outreach Dynamics</h2>
        </div>

        <div class="relative flex items-center mb-6 group">
            <!-- Left Arrow -->
            <button (click)="scrollTabs('left')" class="absolute left-0 z-10 p-1.5 bg-white shadow-md border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity -ml-3" aria-label="Scroll left">
                <z-icon zType="chevron-left" class="w-5 h-5 text-gray-600"></z-icon>
            </button>
            
            <!-- Tabs container -->
            <div #tabsContainer class="flex-1 overflow-x-auto no-scrollbar scroll-smooth px-2 py-1" style="scrollbar-width: none;">
                <ng-container *ngIf="facade.selectedActionTab$ | async as selectedTabIndex; else defaultTab">
                    <div class="flex items-center gap-3 w-max">
                        <button *ngFor="let item of (facade.outreachActions$ | async); let i = index; trackBy: trackByLabel" 
                            (click)="facade.selectActionTab(i)"
                            class="px-5 py-2.5 rounded-xl border transition-all text-[14px] font-semibold whitespace-nowrap flex items-center gap-2 outline-none focus:ring-2 focus:ring-[#005353]/20"
                            [class]="i === selectedTabIndex ? 'bg-[#005353] border-[#005353] text-white shadow-sm' : 'bg-white border-gray-200 text-slate-700 font-normal hover:bg-gray-50 hover:border-gray-300'">
                            <z-icon [zType]="item.icon" class="w-4 h-4" [class]="i === selectedTabIndex ? 'text-white' : 'text-gray-400'"></z-icon>
                            <span>{{item.label}}</span>
                            <span class="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold" 
                                [class]="i === selectedTabIndex ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'">
                                {{item.count}}
                            </span>
                        </button>
                    </div>
                </ng-container>
                <ng-template #defaultTab>
                    <div class="flex items-center gap-3 w-max">
                        <button *ngFor="let item of (facade.outreachActions$ | async); let i = index; trackBy: trackByLabel" 
                            (click)="facade.selectActionTab(i)"
                            class="px-5 py-2.5 rounded-xl border transition-all text-[14px] font-semibold whitespace-nowrap flex items-center gap-2 outline-none focus:ring-2 focus:ring-[#005353]/20"
                            [class]="i === 0 ? 'bg-[#005353] border-[#005353] text-white shadow-sm' : 'bg-white border-gray-200 text-slate-700 font-normal hover:bg-gray-50 hover:border-gray-300'">
                            <z-icon [zType]="item.icon" class="w-4 h-4" [class]="i === 0 ? 'text-white' : 'text-gray-400'"></z-icon>
                            <span>{{item.label}}</span>
                            <span class="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold" 
                                [class]="i === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'">
                                {{item.count}}
                            </span>
                        </button>
                    </div>
                </ng-template>
            </div>
            
            <!-- Right Arrow -->
            <button (click)="scrollTabs('right')" class="absolute right-0 z-10 p-1.5 bg-white shadow-md border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity -mr-3" aria-label="Scroll right">
                <z-icon zType="chevron-right" class="w-5 h-5 text-gray-600"></z-icon>
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
  
  @ViewChild('tabsContainer') tabsContainer!: ElementRef<HTMLDivElement>;

  trackByLabel(index: number, item: any): string {
    return item.label;
  }

  scrollTabs(direction: 'left' | 'right') {
    if (this.tabsContainer) {
      const scrollAmount = 300;
      const element = this.tabsContainer.nativeElement;
      if (direction === 'left') {
        element.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        element.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  }
}
