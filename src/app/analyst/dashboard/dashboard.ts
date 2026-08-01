import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ZardIconComponent } from '@/shared/components/icon';

import { DashboardFacade } from './dashboard.facade';
import { OutreachSummaryWidgetComponent } from './widgets/outreach-summary/outreach-summary-widget.component';
import { CoverageWidgetComponent } from './widgets/coverage/coverage-widget.component';

@Component({
  selector: 'app-analyst-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    LottieComponent, 
    OutreachSummaryWidgetComponent,
    CoverageWidgetComponent
  ],
  providers: [DashboardFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class AnalystDashboard {
  public facade = inject(DashboardFacade);

  options: AnimationOptions = { path: '/loading.json' };
  subLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };
}
