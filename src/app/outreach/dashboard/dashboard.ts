import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ZardIconComponent } from '@/shared/components/icon';

import { DashboardFacade } from './dashboard.facade';
import { DashboardActionsWidgetComponent } from './widgets/dashboard-actions/dashboard-actions-widget.component';
import { OutreachSummaryWidgetComponent } from './widgets/outreach-summary/outreach-summary-widget.component';
import { CoverageWidgetComponent } from './widgets/coverage/coverage-widget.component';
import { ActivitySessionsWidgetComponent } from './widgets/activity-sessions/activity-sessions-widget.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    LottieComponent, 
    ZardIconComponent,
    DashboardActionsWidgetComponent,
    OutreachSummaryWidgetComponent,
    CoverageWidgetComponent,
    ActivitySessionsWidgetComponent
  ],
  providers: [DashboardFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  public facade = inject(DashboardFacade);

  options: AnimationOptions = { path: '/loading.json' };
  subLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };
}
