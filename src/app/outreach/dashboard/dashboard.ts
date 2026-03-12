import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, shareReplay } from 'rxjs';

import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { OutreachService } from '../outreach.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ZardButtonComponent, ZardIconComponent, LottieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private outreachService = inject(OutreachService);
  private authService = inject(AuthService);

  private currentUserId = Number(this.authService.getCurrentUser()?.sub) || undefined;
  options: AnimationOptions = { path: '/loading.json' };

  stats$ = this.outreachService.getDashboardStats(this.currentUserId).pipe(
    catchError(() =>
      of({
        totalBeneficiaries: 0,
        assignedProjects: 0,
        assignedLocations: 0,
      })
    ),
    shareReplay(1)
  );

  recentBeneficiaries$ = this.outreachService.getBeneficiaries().pipe(
    map((rows) => rows.slice(0, 5)),
    catchError(() => of([])),
    shareReplay(1)
  );

}
