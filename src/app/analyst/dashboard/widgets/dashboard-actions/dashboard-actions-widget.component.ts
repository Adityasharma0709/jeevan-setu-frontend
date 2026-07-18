import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
  selector: 'app-dashboard-actions-widget',
  standalone: true,
  imports: [RouterLink, ZardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-4 mb-6 pt-4">
        <button routerLink="/outreach/report-activity" class="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#CCFBF1] bg-white shadow-sm text-green-700 hover:bg-green-50 transition-colors text-sm font-medium">
            <z-icon zType="plus" class="w-4 h-4"></z-icon> Add Report
        </button>
        <button routerLink="/outreach/beneficiaries/create" class="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#CCFBF1] bg-white shadow-sm text-green-700 hover:bg-green-50 transition-colors text-sm font-medium">
            <z-icon zType="plus" class="w-4 h-4"></z-icon> Add Beneficiary
        </button>
        <button routerLink="/outreach/requests" class="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#CCFBF1] bg-white shadow-sm text-green-700 hover:bg-green-50 transition-colors text-sm font-medium">
            <z-icon zType="file-text" class="w-4 h-4"></z-icon> Review Requests
        </button>
    </div>
  `
})
export class DashboardActionsWidgetComponent {}
