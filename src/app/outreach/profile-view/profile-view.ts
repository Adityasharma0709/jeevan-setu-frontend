import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OutreachService, Beneficiary, BeneficiaryGroup, OutreachActivity, OutreachSession } from '../outreach.service';
import { toast } from 'ngx-sonner';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
    selector: 'app-profile-view',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ZardButtonComponent,
        ZardIconComponent
    ],
    templateUrl: './profile-view.html'
})
export class ProfileView implements OnInit {
    beneficiary: Beneficiary | null = null;
    loading = true;

    // Update Form
    isUpdateModalOpen = false;
    updateForm: any = {};

    // Tagging
    groups: BeneficiaryGroup[] = [];
    activities: OutreachActivity[] = [];
    sessions: OutreachSession[] = [];

    selectedGroupId: number | null = null;
    selectedActivityId: number | null = null;
    selectedSessionId: number | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private outreachService: OutreachService
    ) { }

    goBack() {
        history.back();
    }

    ngOnInit() {
        this.route.params.subscribe(params => {
            if (params['id']) {
                const ben = history.state.beneficiary;
                if (ben) {
                    this.beneficiary = ben;
                    this.loading = false;
                    this.loadTaggingOptions();
                } else {
                    this.outreachService.getBeneficiary(+params['id']).subscribe({
                        next: (data) => {
                            this.beneficiary = data;
                            this.loading = false;
                            this.loadTaggingOptions();
                        },
                        error: () => {
                            toast.error('Beneficiary not found');
                            this.loading = false;
                        }
                    });
                }
            }
        });

        this.outreachService.getGroups().subscribe(groups => this.groups = groups);
        this.outreachService.getOutreachActivities().subscribe(acts => this.activities = acts);
    }

    loadTaggingOptions() {
        // already loading groups/activities in onInit
    }

    onActivityChange() {
        if (this.selectedActivityId) {
            this.outreachService.getSessions(this.selectedActivityId).subscribe(sessions => this.sessions = sessions);
        } else {
            this.sessions = [];
        }
    }

    saveGroupTag() {
        if (!this.beneficiary || !this.selectedGroupId) return;
        this.outreachService.tagBeneficiaryGroup(this.beneficiary.id, this.selectedGroupId).subscribe({
            next: () => toast.success('Group tagged successfully'),
            error: () => toast.error('Failed to tag group')
        });
    }

    saveActivityTag() {
        if (!this.beneficiary || !this.selectedActivityId || !this.selectedSessionId) return;
        this.outreachService.tagBeneficiaryActivity(this.beneficiary.id, this.selectedActivityId, this.selectedSessionId).subscribe({
            next: () => toast.success('Activity tagged successfully'),
            error: () => toast.error('Failed to tag activity')
        });
    }

    // Update Modal Logic
    openUpdateModal() {
        if (!this.beneficiary) return;
        const b = this.beneficiary;
        this.updateForm = {
            name: b.name,
            mobileNumber: b.mobileNumber,
            dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '',
            gender: b.gender,
            guardianName: b.guardianName,
            monthlyIncome: b.monthlyIncome,
            primaryIncomeSource: b.primaryIncomeSource,
            economicStatus: b.economicStatus,
            employmentStatus: b.employmentStatus,

            // Additional Fields
            qualification: b.qualification || '',
            religion: b.religion || '',
            caste: b.caste || '',
            maritalStatus: b.maritalStatus || '',
            // Handle nullable dates? If null, set empty.
            dateOfMarriage: b.dateOfMarriage ? (new Date(b.dateOfMarriage).toISOString().split('T')[0]) : '', // Assuming dateOfMarriage in DB is DateTime. Schema said String? Schema said String? 
            // Schema says `dateOfMarriage String?`. Wait.
            // Let's check CreateBeneficiaryDto: `dateOfMarriage?: string`.
            // So it's string.
            // But I should check if it's ISO or just string.
            // I will assume standard string for now, but Date input gives YYYY-MM-DD.

            womanAgeAtMarriage: b.womanAgeAtMarriage,
            husbandAgeAtMarriage: b.husbandAgeAtMarriage
        };

        // Fix dateOfMarriage if it's a string, just pass it.
        if (typeof b.dateOfMarriage === 'string') {
            this.updateForm.dateOfMarriage = b.dateOfMarriage;
        }

        this.isUpdateModalOpen = true;
    }

    closeUpdateModal() {
        this.isUpdateModalOpen = false;
    }

    hasChanges(): boolean {
        if (!this.beneficiary) return false;
        const b = this.beneficiary;
        const f = this.updateForm;

        // Basic check
        if (f.name !== b.name ||
            f.mobileNumber !== b.mobileNumber ||
            f.gender !== b.gender ||
            f.guardianName !== b.guardianName ||
            f.monthlyIncome !== b.monthlyIncome ||
            f.primaryIncomeSource !== (b.primaryIncomeSource || '') ||
            f.economicStatus !== b.economicStatus ||
            f.employmentStatus !== (b.employmentStatus || '')) return true;

        const dob = b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '';
        if (f.dateOfBirth !== dob) return true;

        // Additional
        if (f.qualification !== (b.qualification || '')) return true;
        if (f.religion !== (b.religion || '')) return true;
        if (f.caste !== (b.caste || '')) return true;
        if (f.maritalStatus !== (b.maritalStatus || '')) return true;

        // Date of marriage - string
        if (f.dateOfMarriage !== (b.dateOfMarriage || '')) return true;

        if (f.womanAgeAtMarriage != b.womanAgeAtMarriage) return true; // loose equality for null/undefined vs empty
        if (f.husbandAgeAtMarriage != b.husbandAgeAtMarriage) return true;

        return false;
    }

    submitUpdate() {
        if (!this.beneficiary) return;
        const changes: any = {};
        const f = this.updateForm;
        const b = this.beneficiary;

        if (f.name !== b.name) changes.name = f.name;
        if (f.mobileNumber !== b.mobileNumber) changes.mobileNumber = f.mobileNumber;

        const dob = b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '';
        if (f.dateOfBirth !== dob) changes.dateOfBirth = new Date(f.dateOfBirth).toISOString();

        if (f.gender !== b.gender) changes.gender = f.gender;
        if (f.guardianName !== b.guardianName) changes.guardianName = f.guardianName;
        if (f.monthlyIncome !== b.monthlyIncome) changes.monthlyIncome = Number(f.monthlyIncome);
        if (f.primaryIncomeSource !== b.primaryIncomeSource) changes.primaryIncomeSource = f.primaryIncomeSource;
        if (f.economicStatus !== b.economicStatus) changes.economicStatus = f.economicStatus;
        if (f.employmentStatus !== b.employmentStatus) changes.employmentStatus = f.employmentStatus;

        // Additional
        if (f.qualification !== b.qualification) changes.qualification = f.qualification;
        if (f.religion !== b.religion) changes.religion = f.religion;
        if (f.caste !== b.caste) changes.caste = f.caste;
        if (f.maritalStatus !== b.maritalStatus) changes.maritalStatus = f.maritalStatus;
        if (f.dateOfMarriage !== b.dateOfMarriage) changes.dateOfMarriage = f.dateOfMarriage;
        if (f.womanAgeAtMarriage != b.womanAgeAtMarriage) changes.womanAgeAtMarriage = Number(f.womanAgeAtMarriage);
        if (f.husbandAgeAtMarriage != b.husbandAgeAtMarriage) changes.husbandAgeAtMarriage = Number(f.husbandAgeAtMarriage);

        if (Object.keys(changes).length === 0) return;

        this.outreachService.requestBeneficiaryUpdate(this.beneficiary.id, changes).subscribe({
            next: () => {
                toast.success('Update request submitted');
                this.closeUpdateModal();
                this.router.navigate(['/outreach/requests']);
            },
            error: (err) => {
                let msg = err.error?.message || 'Failed to submit';
                if (Array.isArray(msg)) msg = msg.join('\n');
                toast.error(msg);
            }
        });
    }
}
