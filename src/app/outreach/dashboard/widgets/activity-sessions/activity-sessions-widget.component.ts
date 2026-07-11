import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { DashboardFacade } from '../../dashboard.facade';
import { ActivityCardComponent } from '../../components/activity-card/activity-card.component';

@Component({
  selector: 'app-activity-sessions-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardComboboxComponent, ActivityCardComponent],
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

            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                <app-activity-card *ngFor="let item of (facade.activities$ | async); trackBy: trackByLabel" [data]="item"></app-activity-card>
            </div>
        </div>
    </div>
  `
})
export class ActivitySessionsWidgetComponent {
  facade = inject(DashboardFacade);

  trackByLabel(index: number, item: any): string {
    return item.label;
  }
}
