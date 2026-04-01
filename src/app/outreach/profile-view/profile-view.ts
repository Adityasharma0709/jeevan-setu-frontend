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

    // Loader
    options: AnimationOptions = { path: '/loading.json' };

    // UI state
    loading = true;

    // Tagging selections
    selectedGroupId: number | null = null;
    selectedActivityId: number | null = null;
    selectedSessionId: number | null = null;

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

    onActivityChange(): void {
        this.selectedSessionId = null;
        this.sessions = [];

        if (this.selectedActivityId) {
            this.outreachService.getSessions(this.selectedActivityId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({ next: (sessions) => (this.sessions = sessions) });
        }
    }

    saveGroupTag(): void {
        if (!this.beneficiary || !this.selectedGroupId) return;
        this.outreachService.tagBeneficiaryGroup(this.beneficiary.id, this.selectedGroupId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => toast.success('Group tagged successfully'),
                error: () => toast.error('Failed to tag group'),
            });
    }

    saveActivityTag(): void {
        if (!this.beneficiary || !this.selectedActivityId || !this.selectedSessionId) return;
        this.outreachService.tagBeneficiaryActivity(this.beneficiary.id, this.selectedActivityId, this.selectedSessionId)
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

    goBack(): void {
        this.router.navigate(['/outreach/beneficiaries']);
    }
}
