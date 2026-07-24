import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AnalystService } from '../../analyst.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-analyst-beneficiary-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ZardButtonComponent,
    ZardIconComponent,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    LottieComponent,
  ],
  templateUrl: './beneficiary-detail.html',
})
export class BeneficiaryDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private analystService = inject(AnalystService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  readonly isManager = true; // Use this flag to enforce read-only details layout (hide all edits)

  // Data
  beneficiary: any = null;
  activityReports: any[] = [];
  reportsLoading = false;

  // Loader
  options: AnimationOptions = { path: '/loading.json' };

  // UI state
  loading = true;
  activeTab: 'detail' | 'family' | 'history' = 'detail';

  get beneficiaryAge(): number | string {
    if (!this.beneficiary?.dateOfBirth) return '—';
    const dob = new Date(this.beneficiary.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  get isPriority(): boolean {
    if (!this.beneficiary) return false;
    return !!(this.beneficiary.guardianName || this.beneficiary.qualification || this.beneficiary.religion || this.beneficiary.caste);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.loading = false;
      return;
    }

    const stateData = history.state?.beneficiary;
    if (stateData?.id === Number(id) && stateData.uid) {
      this.beneficiary = stateData;
      this.loading = false;
      this.cdr.markForCheck();
      this.loadReports(stateData.id);
      this.loadFamilyMembers(stateData.id);
      return;
    }

    this.analystService.getBeneficiary(Number(id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.beneficiary = data;
          this.loading = false;
          this.cdr.markForCheck();
          this.loadReports(data.id);
          this.loadFamilyMembers(data.id);
        },
        error: () => {
          toast.error('Beneficiary not found');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFamilyMembers(beneficiaryId: number): void {
    this.analystService.getFamilyMembers(beneficiaryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members) => {
          if (this.beneficiary?.id === beneficiaryId) {
            this.beneficiary.children = members;
          }
          this.cdr.markForCheck();
        },
        error: () => {}
      });
  }

  private loadReports(beneficiaryId: number): void {
    this.reportsLoading = true;
    this.analystService.getReportsByBeneficiary(beneficiaryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports) => {
          this.activityReports = reports;
          this.reportsLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.reportsLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  getScreeningBadge(report: any): string {
    return report?.reportData?.screening === 'Yes' ? 'Yes' : 'No';
  }

  getLocationPart(val: any): string {
    if (!val) return '—';
    return (val?.name || val).toString();
  }

  goBack(): void {
    this.router.navigate(['/analyst/beneficiary']);
  }
}
