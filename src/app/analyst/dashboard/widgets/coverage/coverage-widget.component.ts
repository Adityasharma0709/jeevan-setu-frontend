import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { DashboardFacade } from '../../dashboard.facade';
import { EpisodeCardComponent } from '../../components/episode-card/episode-card.component';

@Component({
  selector: 'app-coverage-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardComboboxComponent, EpisodeCardComponent],
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

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8 mb-8">
            <div class="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
                <div class="flex items-center gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">Episodes of Care</h3>
                        <p class="text-sm text-gray-500 font-medium">Total Episodes</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-4xl font-black text-gray-800 tracking-tight">{{facade.filteredReportsCount$ | async}}</div>
                    <div class="text-xs font-bold text-gray-500 tracking-wide mt-1">reports logged</div>
                </div>
            </div>

            <div class="mb-5 text-xs text-gray-400 font-bold uppercase tracking-widest pl-1">Age & Gender Distribution</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <app-episode-card *ngFor="let item of (facade.episodesOfCare$ | async); trackBy: trackByLabel" [data]="item"></app-episode-card>
            </div>
        </div>
    </div>
  `
})
export class CoverageWidgetComponent {
  facade = inject(DashboardFacade);

  trackByLabel(index: number, item: any): string {
    return item.label;
  }
}
