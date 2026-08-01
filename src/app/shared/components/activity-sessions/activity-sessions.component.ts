import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ChangeDetectorRef, inject, TemplateRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { ZardIconComponent } from '@/shared/components/icon';
import {
  ZardTableComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';
import { ZardCardComponent } from '@/shared/components/card';
import { ZardCalendarComponent } from '@/shared/components/calendar/calendar.component';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'z-activity-sessions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ZardComboboxComponent,
    ZardIconComponent,
    ZardTableComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardPaginationComponent,
    ZardCardComponent,
    ZardCalendarComponent,
    ZardDialogModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8 mb-8 animate-fadeIn">
         <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100/50">
            <div>
                <h3 class="text-xl font-bold text-gray-800">Activity / Sessions</h3>
                <p class="text-xs text-gray-400 font-semibold mt-0.5">Filter and view outreach counts by activity categories</p>
            </div>

            <div class="flex flex-wrap items-center gap-4">
                <div class="flex flex-col gap-1 w-44">
                    <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Activity</label>
                    <z-combobox *ngIf="activityFilter" [options]="activityOptions" [formControl]="activityFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Activity..." class="w-full"></z-combobox>
                </div>
                <div class="flex flex-col gap-1 w-44">
                    <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Session</label>
                    <z-combobox *ngIf="sessionFilter" [options]="sessionOptions" [formControl]="sessionFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Session..." class="w-full"></z-combobox>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest opacity-0 select-none">Export</label>
                    <button type="button" (click)="openExportDialog()"
                      class="inline-flex items-center justify-center gap-3 rounded-full bg-[#006666] px-5 py-2 text-white shadow-[0_14px_28px_rgba(0,102,102,0.24)] transition hover:bg-[#005353] cursor-pointer h-[38px]">
                      <img src="excel.png" alt="excel download button" class="h-6 w-6 object-contain" />
                      <span class="text-xs font-semibold leading-none">Download sheet</span>
                    </button>
                </div>
            </div>
         </div>

         <!-- Clickable Cards Grid -->
         <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8 animate-fadeIn">
             <button *ngFor="let item of activities; let i = index; trackBy: trackByLabel" 
                 (click)="tabChange.emit(i)"
                 type="button"
                 class="w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 rounded-3xl transition-transform hover:scale-[1.01]">
                 <z-card 
                   [label]="item.label" 
                   [count]="item.count" 
                   [isSelected]="i === selectedActivityTab">
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
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Beneficiary ID</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Name</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Age</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Group</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">District</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Block</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Village</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">School</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">AWC</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Beneficiary Type</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Activity Name</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Session Name</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Session Date</span></th>
                              <th z-table-head class="border-b border-slate-300 px-3 py-2 cursor-pointer select-none"><span class="flex items-center gap-1">Mother's Name</span></th>
                          </tr>
                      </thead>
                      <tbody z-table-body class="divide-y divide-slate-100 text-[13px]" *ngIf="{ page: currentActivityPage, total: totalActivityRecords } as state">
                          <ng-container *ngIf="activityTableData as records; else loadingTable">
                              <tr z-table-row *ngFor="let row of records; let idx = index" class="align-top hover:bg-slate-50 transition-colors">
                                  <td z-table-cell class="px-2 py-3 text-center font-semibold text-slate-700">
                                    {{ (state.page * 10) + idx + 1 }}
                                  </td>
                                  <td z-table-cell 
                                      (click)="row.benId && beneficiaryClick.emit(row.benId)" 
                                      [class.cursor-pointer]="row.benId"
                                      [class.underline]="row.benId"
                                      [class.hover:text-blue-800]="row.benId"
                                      class="px-3 py-3 font-mono text-[12px] text-blue-600 select-none"
                                      [title]="row.benId ? 'Click to view profile detail' : ''">
                                    {{ row.id || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 font-bold text-slate-800">
                                    {{ row.name || 'Unknown' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.age || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 font-medium text-slate-700">
                                    {{ row.group }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.district || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.block || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.village || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700 font-semibold text-slate-500">
                                    {{ row.school || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.awc || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.beneficiaryType || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700 font-medium">
                                    {{ row.activity || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.session || '-' }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 whitespace-nowrap text-slate-700">
                                    {{ row.reportingDate }}
                                  </td>
                                  <td z-table-cell class="px-3 py-3 text-slate-700">
                                    {{ row.motherName || 'N/A' }}
                                  </td>
                              </tr>
                              <tr z-table-row *ngIf="records.length === 0">
                                  <td z-table-cell [attr.colspan]="15" class="px-4 py-12 text-center text-sm font-semibold italic text-slate-500">
                                      No reports found for this group.
                                  </td>
                              </tr>
                          </ng-container>
                          <ng-template #loadingTable>
                              <tr z-table-row>
                                  <td z-table-cell [attr.colspan]="15" class="px-4 py-8 text-center text-gray-500">
                                      <z-icon zType="loader-circle" class="w-6 h-6 animate-spin mx-auto text-blue-500"></z-icon>
                                      <p class="mt-2 font-medium text-sm">Loading records...</p>
                                  </td>
                              </tr>
                          </ng-template>
                     </tbody>
                 </table>
             </div>
             <div class="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                 <ng-container *ngIf="{ page: currentActivityPage, total: totalActivityRecords } as state">
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

    <ng-template #exportDialog>
       <div class="space-y-4 py-2">
          <div class="flex flex-col gap-1.5">
              <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Export Range Option</label>
              <z-combobox [(ngModel)]="exportMode" [options]="exportOptions" zWidth="full" class="w-full"></z-combobox>
          </div>

          <div *ngIf="exportMode === 'RANGE'" class="space-y-3 mt-4 animate-fadeIn">
              <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                  <z-calendar zMode="range" [(value)]="exportDateRange" class="mx-auto"></z-calendar>
              </div>

              <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-xs text-slate-600">
                  <span class="font-bold uppercase tracking-wider text-slate-400">Selected Range</span>
                  <span class="text-right font-bold text-slate-800">
                      <ng-container *ngIf="exportDateRange && exportDateRange.length > 0; else noRange">
                          <ng-container *ngIf="exportDateRange.length === 2">
                              {{ exportDateRange[0] | date: 'dd-MM-yyyy' }} - {{ exportDateRange[1] | date: 'dd-MM-yyyy' }}
                          </ng-container>
                          <ng-container *ngIf="exportDateRange.length === 1">
                              {{ exportDateRange[0] | date: 'dd-MM-yyyy' }}
                          </ng-container>
                      </ng-container>
                      <ng-template #noRange>Not Selected</ng-template>
                  </span>
              </div>
          </div>
       </div>
     </ng-template>
  `
})
export class ZardActivitySessionsComponent {
  @Input() activityOptions: any[] = [];
  @Input() sessionOptions: any[] = [];
  @Input() activityFilter?: FormControl;
  @Input() sessionFilter?: FormControl;
  @Input() activities: any[] = [];
  @Input() selectedActivityTab: number = 0;
  @Input() activityTableData: any[] | null = null;
  @Input() currentActivityPage: number = 0;
  @Input() totalActivityRecords: number = 0;
  @Input() allActivityRecords: any[] | null = null;

  @Output() tabChange = new EventEmitter<number>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() beneficiaryClick = new EventEmitter<number>();

  Math = Math;

  private dialog = inject(ZardDialogService);
  private cdr = inject(ChangeDetectorRef);

  private _exportMode: 'ALL' | 'RANGE' = 'ALL';
  get exportMode() { return this._exportMode; }
  set exportMode(val: 'ALL' | 'RANGE') {
    this._exportMode = val;
    this.cdr.markForCheck();
  }

  private _exportDateRange: Date[] | null = null;
  get exportDateRange() { return this._exportDateRange; }
  set exportDateRange(val: Date[] | null) {
    this._exportDateRange = val;
    this.cdr.markForCheck();
  }

  exportOptions = [
    { value: 'ALL', label: 'All Records' },
    { value: 'RANGE', label: 'Date Range' }
  ];

  readonly exportDialog = viewChild.required<TemplateRef<any>>('exportDialog');

  openExportDialog() {
    this.exportMode = 'ALL';
    this.exportDateRange = null;
    this.dialog.create({
      zTitle: 'Export Activity Reports',
      zContent: this.exportDialog(),
      zOkText: 'Export',
      zCancelText: null,
      zOnOk: () => {
        this.exportToExcel();
      }
    });
  }

  exportToExcel() {
    const reports = this.allActivityRecords || [];
    let exportReports: any[] = [];

    switch (this.exportMode) {
      case 'ALL':
        exportReports = reports;
        break;
      case 'RANGE':
        exportReports = this.filterReportsByDateRange(reports);
        break;
      default:
        exportReports = reports;
    }

    if (exportReports.length === 0) {
      toast.error('No reports found to export.');
      return;
    }

    const data = exportReports.map((row: any, index: number) => {
      return {
        '#': index + 1,
        'Beneficiary ID': row.id || '-',
        'Name': row.name || 'Unknown',
        'Age': row.age || '-',
        'Group': row.group || '-',
        'District': row.district || '-',
        'Block': row.block || '-',
        'Village': row.village || '-',
        'School': row.school || '-',
        'AWC': row.awc || '-',
        'Beneficiary Type': row.beneficiaryType || '-',
        'Activity Name': row.activity || '-',
        'Session Name': row.session || '-',
        'Session Date': row.reportingDate || '-',
        'Mother\'s Name': row.motherName || 'N/A'
      };
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    worksheet['!cols'] = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((row: any) => String(row[key] ?? '').length)) + 2,
    }));

    const workbook: XLSX.WorkBook = {
      Sheets: { Reports: worksheet },
      SheetNames: ['Reports'],
    };

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob(
      [excelBuffer],
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
      }
    );

    const groupName = this.activities[this.selectedActivityTab]?.label || 'Activity';
    saveAs(blob, `activity_sessions_${groupName.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
  }

  private filterReportsByDateRange(reports: any[]): any[] {
    const range = (this.exportDateRange || []).filter(Boolean) as Date[];
    if (range.length === 0) {
      return reports;
    }
    const startDate = range[0];
    const endDate = range[1] ?? range[0];
    const startOfStartDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endOfStartDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    const startOfEndDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    const endOfEndDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    const lowerBound = Math.min(startOfStartDay, startOfEndDay);
    const upperBound = Math.max(endOfStartDay, endOfEndDay);

    return reports.filter((report) => {
      const timestamp = this.toDateTimestamp(report.reportingDate);
      if (timestamp === null) {
        return false;
      }
      return timestamp >= lowerBound && timestamp <= upperBound;
    });
  }

  private toDateTimestamp(value: any): number | null {
    if (!value) return null;
    if (value instanceof Date) {
      const time = value.getTime();
      return Number.isNaN(time) ? null : time;
    }
    const text = String(value).trim();
    if (!text) return null;

    const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }

    const slashMatch = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }

    const parsed = new Date(text);
    const time = parsed.getTime();
    return Number.isNaN(time) ? null : time;
  }

  trackByLabel(index: number, item: any): string {
    return item.label;
  }
}
