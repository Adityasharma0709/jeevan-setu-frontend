import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { DashboardFacade } from '../../dashboard.facade';
import { ZardEpisodesOfCareComponent } from '@/shared/components/episodes-of-care';
import { ZardActivitySessionsComponent } from '@/shared/components/activity-sessions';

@Component({
  selector: 'app-coverage-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardComboboxComponent, ZardEpisodesOfCareComponent, ZardActivitySessionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pt-4">
        <h2 class="text-2xl font-bold text-gray-800 mb-1">Coverage Dashboard</h2>
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
        </div>

        <z-episodes-of-care 
          [totalReports]="facade.filteredReportsCount$ | async" 
          [episodes]="(facade.episodesOfCare$ | async) || []"
        ></z-episodes-of-care>

        <z-activity-sessions
          [activityOptions]="(facade.activityOptions$ | async) || []"
          [sessionOptions]="(facade.sessionOptions$ | async) || []"
          [activityFilter]="facade.activityFilter"
          [sessionFilter]="facade.sessionFilter"
          [activities]="(facade.activities$ | async) || []"
          [selectedActivityTab]="((facade.selectedActivityTab$ | async) ?? 0)"
          [activityTableData]="(facade.activityTableData$ | async)"
          [currentActivityPage]="((facade.currentActivityPage$ | async) ?? 0)"
          [totalActivityRecords]="((facade.totalActivityRecords$ | async) ?? 0)"
          [selectedActivityTab]="((facade.selectedActivityTab$ | async) ?? 0)"
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
}
