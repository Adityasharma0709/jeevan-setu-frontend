import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { ZardSwitchComponent } from '@/shared/components/switch';
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
    ZardSwitchComponent,
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
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">VILLAGE</label>
                <z-combobox [options]="(facade.villageOptions$ | async) || []" [formControl]="facade.villageFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Village..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 w-48">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">INSTITUTION</label>
                <z-combobox [options]="(facade.institutionOptions$ | async) || []" [formControl]="facade.institutionFilter" zWidth="full" [searchable]="true" searchPlaceholder="Search Institution..." class="w-full"></z-combobox>
            </div>
            <div class="flex flex-col gap-1.5 mt-auto">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">UNIQUE COUNT</label>
                <div class="flex items-center h-[38px] px-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50/80 transition-colors">
                  <z-switch 
                    [zChecked]="((facade.uniqueCount$ | async) ?? false)"
                    (zCheckedChange)="facade.toggleUniqueCount()"
                  >
                    <span class="text-xs font-semibold text-gray-700 select-none cursor-pointer">Unique</span>
                  </z-switch>
                </div>
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
