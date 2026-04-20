import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { OutreachService, Beneficiary, BeneficiaryGroup, OutreachActivity, OutreachSession } from '../outreach.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';

@Component({
    selector: 'app-profile-view',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        ZardButtonComponent,
        ZardIconComponent,
        ZardBreadcrumbComponent,
        ZardBreadcrumbItemComponent,
        ZardComboboxComponent,
        LottieComponent,
    ],
    templateUrl: './profile-view.html',
})
export class ProfileView implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private outreachService = inject(OutreachService);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    // Data
    beneficiary: Beneficiary | null = null;
    groups: BeneficiaryGroup[] = [];
    activities: OutreachActivity[] = [];
    sessions: OutreachSession[] = [];
    activityReports: any[] = [];
    reportsLoading = false;

    // Loader
    options: AnimationOptions = { path: '/loading.json' };

    // UI state
    loading = true;
    activeTab: 'detail' | 'history' = 'detail';

    // Tagging selections (Combobox expects string | null)
    selectedGroupId: string | null = null;
    selectedActivityId: string | null = null;
    selectedSessionId: string | null = null;

    // Options mapping
    get groupOptions(): ZardComboboxOption[] {
        return this.groups.map(g => ({ value: g.id.toString(), label: g.name }));
    }

    get activityOptions(): ZardComboboxOption[] {
        return this.activities.map(a => ({ value: a.id.toString(), label: a.name }));
    }

    get sessionOptions(): ZardComboboxOption[] {
        return this.sessions.map(s => ({ value: s.id.toString(), label: s.name }));
    }

    ngOnInit(): void {
        const id = this.route.snapshot.params['id'];

        if (!id) {
            this.loading = false;
            return;
        }

        // Load tagging options in parallel
        forkJoin({
            groups: this.outreachService.getGroups(),
            activities: this.outreachService.getOutreachActivities(),
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
            next: ({ groups, activities }) => {
                this.groups = groups;
                this.activities = activities;
                this.cdr.markForCheck();
            },
        });

        // Use router state if navigated from list (avoid redundant API call)
        const stateData = history.state?.beneficiary;
        if (stateData?.id) {
            this.beneficiary = stateData;
            this.loading = false;
            this.cdr.markForCheck();
            this.loadReports(stateData.id);
            return;
        }

        // Fallback: fetch from API (handles direct URL / page refresh)
        this.outreachService.getBeneficiary(+id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => {
                    this.beneficiary = data;
                    this.loading = false;
                    this.cdr.markForCheck();
                    this.loadReports(data.id);
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

    onActivityChange(activityId: string | null): void {
        this.selectedActivityId = activityId;
        this.selectedSessionId = null;
        this.sessions = [];

        if (this.selectedActivityId) {
            this.outreachService.getSessions(Number(this.selectedActivityId))
                .pipe(takeUntil(this.destroy$))
                .subscribe({ next: (sessions) => (this.sessions = sessions) });
        }
    }

    saveGroupTag(): void {
        if (!this.beneficiary || !this.selectedGroupId) return;
        this.outreachService.tagBeneficiaryGroup(this.beneficiary.id, Number(this.selectedGroupId))
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => toast.success('Group tagged successfully'),
                error: () => toast.error('Failed to tag group'),
            });
    }

    saveActivityTag(): void {
        if (!this.beneficiary || !this.selectedActivityId || !this.selectedSessionId) return;
        this.outreachService.tagBeneficiaryActivity(this.beneficiary.id, Number(this.selectedActivityId), Number(this.selectedSessionId))
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => toast.success('Activity tagged successfully'),
                error: () => toast.error('Failed to tag activity'),
            });
    }

    goToRequestUpdate(): void {
        if (!this.beneficiary) return;
        this.router.navigate(
            ['/outreach/beneficiary', this.beneficiary.id, 'request-update'],
            { state: { beneficiary: this.beneficiary } }
        );
    }

    private loadReports(beneficiaryId: number): void {
        this.reportsLoading = true;
        this.outreachService.getReportsByBeneficiary(beneficiaryId)
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

    goBack(): void {
        this.router.navigate(['/outreach/beneficiaries']);
    }
}
