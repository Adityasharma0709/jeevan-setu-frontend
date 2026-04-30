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
import { ZardDialogService } from '@/shared/components/dialog';
import { ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';

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
    private dialog = inject(ZardDialogService);
    private viewContainerRef = inject(ViewContainerRef);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    @ViewChild('familyModalTemplate') familyModalTemplate!: TemplateRef<any>;
    private dialogRef: any;

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
    activeTab: 'detail' | 'family' | 'history' = 'detail';

    // Tagging selections (Combobox expects string | null)
    selectedGroupId: string | null = null;
    selectedActivityId: string | null = null;
    selectedSessionId: string | null = null;

    // Family Member Modal
    showFamilyModal = false;
    savingFamily = false;
    familyForm = {
        name: '',
        relationship: '',
        dateOfBirth: '',
        gender: '',
        schoolingStatus: '',
        employmentStatus: '',
        qualification: ''
    };

    get familyAge(): number {
        if (!this.familyForm.dateOfBirth) return 0;
        const dob = new Date(this.familyForm.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        return age;
    }

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

    // Family Member Options
    relationshipOptions: ZardComboboxOption[] = [
        { value: 'Son/Daughter', label: 'Son/Daughter' },
        { value: 'Spouse', label: 'Spouse' },
        { value: 'Parents/In-Laws', label: 'Parents/In-Laws' },
        { value: 'Others', label: 'Others' }
    ];

    genderOptions: ZardComboboxOption[] = [
        { value: 'Female', label: 'Female' },
        { value: 'Male', label: 'Male' },
        { value: 'Other', label: 'Other' }
    ];

        qualificationOptions: ZardComboboxOption[] = [
        { value: 'No Formal Education', label: 'No Formal Education' },
        { value: 'Primary (Class 1–5)', label: 'Primary (Class 1–5)' },
        { value: 'Upper Primary (Class 6–8)', label: 'Upper Primary (Class 6–8)' },
        { value: 'Secondary (Class 9–10)', label: 'Secondary (Class 9–10)' },
        { value: 'Senior Secondary (Class 11–12)', label: 'Senior Secondary (Class 11–12)' },
        { value: 'Diploma / ITI', label: 'Diploma / ITI' },
        { value: 'Graduate', label: 'Graduate' },
        { value: 'Post Graduate', label: 'Post Graduate' },
    ];
        qualificationStudyingOptions: ZardComboboxOption[] = [
        { value: 'Primary (Class 1–5)', label: 'Primary (Class 1–5)' },
        { value: 'Upper Primary (Class 6–8)', label: 'Upper Primary (Class 6–8)' },
        { value: 'Secondary (Class 9–10)', label: 'Secondary (Class 9–10)' },
        { value: 'Senior Secondary (Class 11–12)', label: 'Senior Secondary (Class 11–12)' },
        { value: 'Diploma / ITI', label: 'Diploma / ITI' },
        { value: 'Graduate', label: 'Graduate' },
        { value: 'Post Graduate', label: 'Post Graduate' },
    ];

    schoolingOptions: ZardComboboxOption[] = [
        { value: 'Currently studying', label: 'Currently Studying' },
        { value: 'Not studying', label: 'Not Studying' },
    ];

    employmentOptions: ZardComboboxOption[] = [
        { value: 'Employed', label: 'Employed' },
        { value: 'Unemployed', label: 'Unemployed' },
        { value: 'Self-Employed', label: 'Self-Employed' },
        { value: 'Student', label: 'Student' },
        { value: 'Home Maker', label: 'Home Maker' }
    ];

    get filteredEmploymentOptions(): ZardComboboxOption[] {
        if (this.familyForm.schoolingStatus === 'Currently studying') {
            return this.employmentOptions.filter(opt => opt.value === 'Student');
        }
        return this.employmentOptions;
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
            this.loadFamilyMembers(stateData.id);
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

    onSchoolingStatusChange(status: string | null): void {
        if (status === 'Currently studying') {
            this.familyForm.employmentStatus = 'Student';
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

    openFamilyModal(): void {
        this.familyForm = {
            name: '',
            relationship: '',
            dateOfBirth: '',
            gender: 'Female',
            schoolingStatus: '',
            employmentStatus: '',
            qualification: ''
        };
        
        this.dialogRef = this.dialog.create({
            zTitle: 'Add Family Member',
            zContent: this.familyModalTemplate,
            zWidth: '500px',
            zViewContainerRef: this.viewContainerRef,
            zHideFooter: true // We use our own footer in the template
        });
    }

    closeFamilyModal(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
            this.dialogRef = null;
        }
    }

    saveFamilyMember(): void {
        if (!this.beneficiary) return;
        
        // Basic validation
        if (!this.familyForm.name || !this.familyForm.relationship || !this.familyForm.dateOfBirth || !this.familyForm.gender) {
            toast.error('Please fill all required fields');
            return;
        }

        const age = this.familyAge;
        if (age <= 14 && !this.familyForm.schoolingStatus) {
            toast.error('Schooling status is required for children');
            return;
        }
        if (age > 14 && !this.familyForm.employmentStatus) {
            toast.error('Employment status is required for adults');
            return;
        }
        if (age > 6 && !this.familyForm.qualification) {
            toast.error('Qualification is required');
            return;
        }

        this.savingFamily = true;
        this.outreachService.addFamilyMember(this.beneficiary.id, this.familyForm)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    toast.success('Family member added successfully');

                    this.loadFamilyMembers(this.beneficiary!.id, () => {
                        this.closeFamilyModal();
                        this.savingFamily = false;
                        this.cdr.markForCheck();
                    });
                },
                error: (err) => {
                    toast.error(err.error?.message || 'Failed to add family member');
                    this.savingFamily = false;
                    this.cdr.markForCheck();
                }
            });
    }

    private loadFamilyMembers(beneficiaryId: number, onDone?: () => void): void {
        this.outreachService.getFamilyMembers(beneficiaryId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (members) => {
                    if (this.beneficiary?.id === beneficiaryId) {
                        this.beneficiary.children = members;
                    }
                    this.cdr.markForCheck();
                    onDone?.();
                },
                error: () => {
                    onDone?.();
                },
            });
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

    getLocationPart(val: any): string {
        if (!val) return '—';
        return (val?.name || val).toString();
    }

    goBack(): void {
        this.router.navigate(['/outreach/beneficiaries']);
    }
}
