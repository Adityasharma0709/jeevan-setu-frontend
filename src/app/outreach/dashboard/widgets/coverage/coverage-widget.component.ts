import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { DashboardFacade } from '../../dashboard.facade';
import { ZardEpisodesOfCareComponent, ZardEpisodeCardComponent, ZardEpisodeCardFemaleComponent, ZardEpisodeCardMaleChildComponent } from '@/shared/components/episodes-of-care';
import { ZardActivitySessionsComponent } from '@/shared/components/activity-sessions';

@Component({
  selector: 'app-coverage-widget',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ZardComboboxComponent, 
    ZardEpisodesOfCareComponent, 
    ZardEpisodeCardComponent,
    ZardEpisodeCardFemaleComponent,
    ZardEpisodeCardMaleChildComponent,
    ZardActivitySessionsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pt-4">
        <h2 class="text-2xl font-bold text-gray-800 mb-1">Project Reach</h2>
        <p class="text-gray-500 text-sm mb-6">Track reach and episodes of care</p>

        <div class="flex flex-wrap items-center gap-4 mb-6">
            <div class="flex flex-col gap-1.5 w-40">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">YEAR</label>
                <z-combobox [options]="(facade.yearOptions$ | async) || []" [formControl]="facade.yearFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Year..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-40">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">MONTH</label>
                <z-combobox [options]="(facade.monthOptions$ | async) || []" [formControl]="facade.monthFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Month..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">STATE</label>
                <z-combobox [options]="(facade.stateOptions$ | async) || []" [formControl]="facade.stateFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search State..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">DISTRICT</label>
                <z-combobox [options]="(facade.districtOptions$ | async) || []" [formControl]="facade.districtFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search District..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">BLOCK</label>
                <z-combobox [options]="(facade.blockOptions$ | async) || []" [formControl]="facade.blockFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Block..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">AWC CENTER</label>
                <z-combobox [options]="(facade.awcOptions$ | async) || []" [formControl]="facade.awcFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search AWC..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 mt-auto">
                <button type="button" 
                  [class]="(facade.uniqueCount$ | async) ? 'px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 transition-all hover:bg-emerald-100/50' : 'px-4 py-2 text-sm font-semibold rounded-lg bg-gray-50 text-gray-500 border border-gray-200 transition-all hover:bg-gray-100/50'"
                  (click)="facade.toggleUniqueCount()"
                >
                  Unique Count
                </button>
            </div>
        </div>

        <z-episodes-of-care 
          [totalReports]="facade.filteredReportsCount$ | async" 
          [episodes]="(facade.episodesOfCare$ | async) || []"
        ></z-episodes-of-care>

        <!-- Health Screenings & Distributions -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8 mb-8 animate-fadeIn">
            <div class="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">Health Screenings & Distributions</h3>
                    <p class="text-sm text-gray-500 font-medium">Beneficiaries reached with health services</p>
                </div>
            </div>

            <div class="mb-5 text-xs text-gray-400 font-bold uppercase tracking-widest pl-1">Service & Gender Distribution</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ng-container *ngFor="let item of (facade.healthScreenings$ | async); trackBy: trackByLabel">
                    <z-episode-card *ngIf="item.male !== undefined" [data]="item"></z-episode-card>
                    <z-episode-card-female *ngIf="item.adolescentGirl !== undefined" [data]="item"></z-episode-card-female>
                    <z-episode-card-male-child *ngIf="item.men !== undefined" [data]="item"></z-episode-card-male-child>
                </ng-container>
            </div>
        </div>

        <z-activity-sessions
          [activityOptions]="(facade.activityOptions$ | async) || []"
          [sessionOptions]="(facade.sessionOptions$ | async) || []"
          [activityFilter]="facade.activityFilter"
          [sessionFilter]="facade.sessionFilter"
          [activities]="(facade.activities$ | async) || []"
          [selectedActivityTab]="((facade.selectedActivityTab$ | async) ?? 0)"
          [activityTableData]="(facade.activityTableData$ | async)"
          [allActivityRecords]="(facade.allActivityRecords$ | async)"
          [currentActivityPage]="((facade.currentActivityPage$ | async) ?? 0)"
          [totalActivityRecords]="((facade.totalActivityRecords$ | async) ?? 0)"
          (tabChange)="facade.selectActivityTab($event)"
          (pageChange)="facade.goToActivityPage($event)"
          (beneficiaryClick)="redirectToBeneficiary($event)"
        ></z-activity-sessions>
    </div>
  `
})
export class CoverageWidgetComponent {
  facade = inject(DashboardFacade);
  router = inject(Router);

  redirectToBeneficiary(benId: number) {
    this.router.navigate(['/outreach/beneficiary', benId]);
  }

  trackByLabel(index: number, item: any): string {
    return item.label;
  }
}
