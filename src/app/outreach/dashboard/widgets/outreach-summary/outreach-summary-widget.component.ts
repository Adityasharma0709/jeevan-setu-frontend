import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DashboardFacade } from '../../dashboard.facade';
import { OutreachDynamicsComponent } from '@/shared/components/outreach-dynamics/outreach-dynamics.component';

@Component({
  selector: 'app-outreach-summary-widget',
  standalone: true,
  imports: [
    CommonModule, 
    OutreachDynamicsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-outreach-dynamics
      [role]="'outreach'"
      [actions]="(facade.outreachActions$ | async) || []"
      [selectedTab]="((facade.selectedActionTab$ | async) ?? 0)"
      [records]="(facade.dynamicsTableData$ | async)"
      [page]="((facade.currentPage$ | async) ?? 0)"
      [totalRecords]="((facade.totalDynamicsRecords$ | async) ?? 0)"
      [showHierarchyFilters]="false"
      (tabChange)="facade.selectActionTab($event)"
      (pageChange)="facade.goToPage($event)"
      (beneficiaryClick)="redirectToBeneficiary($event)"
    ></z-outreach-dynamics>
  `
})
export class OutreachSummaryWidgetComponent {
  facade = inject(DashboardFacade);
  router = inject(Router);

  redirectToBeneficiary(benId: number) {
    this.router.navigate(['/outreach/beneficiary', benId]);
  }
}
