import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '@/core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'z-beneficiary-detail',
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
  templateUrl: './beneficiary-detail.component.html',
})
export class ZardBeneficiaryDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  readonly isManager = true; // Enforce read-only details layout (hide all edits)

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

  get backRoute(): string {
    const url = this.router.url;
    if (url.includes('/outreach')) return '/outreach/beneficiaries';
    if (url.includes('/manager')) return '/manager/beneficiaries';
    return '/analyst/beneficiary';
  }

  get backLabel(): string {
    const url = this.router.url;
    if (url.includes('/outreach') || url.includes('/manager')) return 'Beneficiaries';
    return 'Beneficiary Reports';
  }

  get rolePrefix(): string {
    const url = this.router.url;
    if (url.includes('/outreach')) return 'outreach';
    if (url.includes('/manager')) return 'manager';
    if (url.includes('/admin')) return 'admin';
    return 'analyst';
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

    this.api.get(`${this.rolePrefix}/beneficiary/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
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
    this.api.get(`${this.rolePrefix}/beneficiary/${beneficiaryId}/family-members`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members: any) => {
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
    this.api.get(`${this.rolePrefix}/beneficiary/${beneficiaryId}/reports`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports: any) => {
          this.activityReports = reports || [];
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
    this.router.navigate([this.backRoute]);
  }
}

export { ZardBeneficiaryDetailComponent as BeneficiaryDetail };
