import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagerBeneficiary, ManagerService } from '../manager.service';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ZardButtonComponent } from '@/shared/components/button';
import {
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
    selector: 'app-beneficiaries',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ZardButtonComponent,
        ZardTableComponent,
        ZardTableHeaderComponent,
        ZardTableBodyComponent,
        ZardTableRowComponent,
        ZardTableHeadComponent,
        ZardTableCellComponent,
        ZardIconComponent,
        LottieComponent,
    ],
    templateUrl: './beneficiaries.html'
})
export class Beneficiaries implements OnInit {
    beneficiaries: ManagerBeneficiary[] = [];
    isLoading = true;
    readonly loadingOptions: AnimationOptions = { path: '/loading.json' };

    isModalOpen = false;
    selectedBeneficiary: ManagerBeneficiary | null = null;

    updateForm: {
        name: string;
        mobileNumber: string;
        dateOfBirth: string;
        gender: string;
        guardianName: string;
        religion: string;
        caste: string;
        qualification: string;
        monthlyIncome: number | string | null;
        primaryIncomeSource: string;
        economicStatus: string;
        employmentStatus: string;
        maritalStatus: string;
        dateOfMarriage: string;
        womanAgeAtMarriage: number | string | null;
        husbandAgeAtMarriage: number | string | null;
    } = this.createEmptyForm();

    constructor(
        private managerService: ManagerService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadBeneficiaries();
    }

    private createEmptyForm() {
        return {
            name: '',
            mobileNumber: '',
            dateOfBirth: '',
            gender: '',
            guardianName: '',
            religion: '',
            caste: '',
            qualification: '',
            monthlyIncome: null,
            primaryIncomeSource: '',
            economicStatus: '',
            employmentStatus: '',
            maritalStatus: '',
            dateOfMarriage: '',
            womanAgeAtMarriage: null,
            husbandAgeAtMarriage: null,
        };
    }

    loadBeneficiaries() {
        this.isLoading = true;
        this.managerService.getBeneficiaries().subscribe({
            next: (data: any) => {
                const safeData = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                this.beneficiaries = safeData;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                toast.error('Failed to load beneficiaries');
                this.isLoading = false;
                this.cdr.detectChanges();
                console.error(err);
            }
        });
    }

    private toDateInputValue(value: unknown): string {
        if (!value) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return '';
            // If already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            const d = new Date(trimmed);
            if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
            return '';
        }
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return '';
            return value.toISOString().split('T')[0];
        }
        return '';
    }

    openUpdateModal(beneficiary: ManagerBeneficiary) {
        this.selectedBeneficiary = beneficiary;
        this.updateForm = {
            name: beneficiary.name ?? '',
            mobileNumber: beneficiary.mobileNumber ?? '',
            dateOfBirth: this.toDateInputValue(beneficiary.dateOfBirth),
            gender: beneficiary.gender ?? '',
            guardianName: beneficiary.guardianName ?? '',
            religion: beneficiary.religion ?? '',
            caste: beneficiary.caste ?? '',
            qualification: beneficiary.qualification ?? '',
            monthlyIncome: beneficiary.monthlyIncome ?? null,
            primaryIncomeSource: beneficiary.primaryIncomeSource ?? '',
            economicStatus: beneficiary.economicStatus ?? '',
            employmentStatus: beneficiary.employmentStatus ?? '',
            maritalStatus: beneficiary.maritalStatus ?? '',
            dateOfMarriage: this.toDateInputValue(beneficiary.dateOfMarriage),
            womanAgeAtMarriage: beneficiary.womanAgeAtMarriage ?? null,
            husbandAgeAtMarriage: beneficiary.husbandAgeAtMarriage ?? null,
        };
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.selectedBeneficiary = null;
        this.updateForm = this.createEmptyForm();
    }

    private buildChanges(beneficiary: ManagerBeneficiary, form: typeof this.updateForm) {
        const changes: Record<string, unknown> = {};

        const fName = String(form.name ?? '').trim();
        if (fName && fName !== String(beneficiary.name ?? '').trim()) changes['name'] = fName;

        const fMobile = String(form.mobileNumber ?? '').trim();
        if (fMobile !== String(beneficiary.mobileNumber ?? '').trim()) changes['mobileNumber'] = fMobile;

        const bDob = this.toDateInputValue(beneficiary.dateOfBirth);
        const fDob = this.toDateInputValue(form.dateOfBirth);
        if (fDob !== bDob && fDob) changes['dateOfBirth'] = new Date(fDob).toISOString();

        const fGender = String(form.gender ?? '').trim();
        if (fGender !== String(beneficiary.gender ?? '').trim()) changes['gender'] = fGender;

        const fGuardian = String(form.guardianName ?? '').trim();
        if (fGuardian !== String(beneficiary.guardianName ?? '').trim()) changes['guardianName'] = fGuardian;

        const fReligion = String(form.religion ?? '').trim();
        if (fReligion !== String(beneficiary.religion ?? '').trim()) changes['religion'] = fReligion;

        const fCaste = String(form.caste ?? '').trim();
        if (fCaste !== String(beneficiary.caste ?? '').trim()) changes['caste'] = fCaste;

        const fQualification = String(form.qualification ?? '').trim();
        if (fQualification !== String(beneficiary.qualification ?? '').trim()) changes['qualification'] = fQualification;

        const bMonthlyIncome = beneficiary.monthlyIncome ?? null;
        const fMonthlyIncomeRaw = form.monthlyIncome;
        const fMonthlyIncome = fMonthlyIncomeRaw === null || fMonthlyIncomeRaw === undefined || fMonthlyIncomeRaw === '' ? null : Number(fMonthlyIncomeRaw);
        if (fMonthlyIncome !== bMonthlyIncome && fMonthlyIncome !== null && !Number.isNaN(fMonthlyIncome)) changes['monthlyIncome'] = fMonthlyIncome;

        const fPrimaryIncomeSource = String(form.primaryIncomeSource ?? '').trim();
        if (fPrimaryIncomeSource !== String(beneficiary.primaryIncomeSource ?? '').trim()) changes['primaryIncomeSource'] = fPrimaryIncomeSource;

        const fEconomicStatus = String(form.economicStatus ?? '').trim();
        if (fEconomicStatus !== String(beneficiary.economicStatus ?? '').trim()) changes['economicStatus'] = fEconomicStatus;

        const fEmploymentStatus = String(form.employmentStatus ?? '').trim();
        if (fEmploymentStatus !== String(beneficiary.employmentStatus ?? '').trim()) changes['employmentStatus'] = fEmploymentStatus;

        const fMaritalStatus = String(form.maritalStatus ?? '').trim();
        if (fMaritalStatus !== String(beneficiary.maritalStatus ?? '').trim()) changes['maritalStatus'] = fMaritalStatus;

        if (fMaritalStatus === 'MARRIED') {
            const bDom = this.toDateInputValue(beneficiary.dateOfMarriage);
            const fDom = this.toDateInputValue(form.dateOfMarriage);
            if (fDom !== bDom && fDom) changes['dateOfMarriage'] = fDom;

            const bWomanAge = beneficiary.womanAgeAtMarriage ?? null;
            const fWomanAgeRaw = form.womanAgeAtMarriage;
            const fWomanAge = fWomanAgeRaw === null || fWomanAgeRaw === undefined || fWomanAgeRaw === '' ? null : Number(fWomanAgeRaw);
            if (fWomanAge !== bWomanAge && fWomanAge !== null && !Number.isNaN(fWomanAge)) changes['womanAgeAtMarriage'] = fWomanAge;

            const bHusbandAge = beneficiary.husbandAgeAtMarriage ?? null;
            const fHusbandAgeRaw = form.husbandAgeAtMarriage;
            const fHusbandAge = fHusbandAgeRaw === null || fHusbandAgeRaw === undefined || fHusbandAgeRaw === '' ? null : Number(fHusbandAgeRaw);
            if (fHusbandAge !== bHusbandAge && fHusbandAge !== null && !Number.isNaN(fHusbandAge)) changes['husbandAgeAtMarriage'] = fHusbandAge;
        }

        return changes;
    }

    hasChanges(): boolean {
        if (!this.selectedBeneficiary) return false;
        return Object.keys(this.buildChanges(this.selectedBeneficiary, this.updateForm)).length > 0;
    }

    submitUpdate() {
        if (!this.selectedBeneficiary) return;
        const changes = this.buildChanges(this.selectedBeneficiary, this.updateForm);
        if (Object.keys(changes).length === 0) return;

        // Include current values for context in the request (optional but helpful for display)
        const payload = {
            ...changes,
            current: {
                name: this.selectedBeneficiary.name,
                mobileNumber: this.selectedBeneficiary.mobileNumber
            }
        };

        this.managerService.requestBeneficiaryUpdate(this.selectedBeneficiary.id, payload).subscribe({
            next: () => {
                toast.success('Update request submitted successfully');
                this.closeModal();
                this.cdr.detectChanges();
            },
            error: (err) => {
                toast.error(err.error?.message || 'Failed to submit request');
                this.cdr.detectChanges();
            }
        });
    }

    trackById(_: number, item: ManagerBeneficiary) {
        return item.id;
    }
}
