import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagerService, UserProfile } from '../manager.service';
import { toast } from 'ngx-sonner';
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
        ZardIconComponent
    ],
    templateUrl: './beneficiaries.html'
})
export class Beneficiaries implements OnInit {
    beneficiaries: any[] = [];
    isModalOpen = false;
    selectedBeneficiary: any = null;
    updateForm: any = { name: '', mobileNumber: '' };

    constructor(private managerService: ManagerService) { }

    ngOnInit() {
        this.loadBeneficiaries();
    }

    loadBeneficiaries() {
        this.managerService.getBeneficiaries().subscribe({
            next: (data) => {
                this.beneficiaries = data;
            },
            error: (err) => {
                toast.error('Failed to load beneficiaries');
                console.error(err);
            }
        });
    }

    openUpdateModal(beneficiary: any) {
        this.selectedBeneficiary = beneficiary;
        this.updateForm = {
            name: beneficiary.name,
            mobileNumber: beneficiary.mobileNumber,
            dateOfBirth: beneficiary.dateOfBirth ? new Date(beneficiary.dateOfBirth).toISOString().split('T')[0] : '',
            gender: beneficiary.gender,
            guardianName: beneficiary.guardianName,
            religion: beneficiary.religion,
            caste: beneficiary.caste,
            qualification: beneficiary.qualification,
            monthlyIncome: beneficiary.monthlyIncome,
            primaryIncomeSource: beneficiary.primaryIncomeSource,
            economicStatus: beneficiary.economicStatus,
            employmentStatus: beneficiary.employmentStatus,
            maritalStatus: beneficiary.maritalStatus,
            dateOfMarriage: beneficiary.dateOfMarriage ? new Date(beneficiary.dateOfMarriage).toISOString().split('T')[0] : '',
            womanAgeAtMarriage: beneficiary.womanAgeAtMarriage,
            husbandAgeAtMarriage: beneficiary.husbandAgeAtMarriage
        };
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.selectedBeneficiary = null;
    }

    hasChanges(): boolean {
        if (!this.selectedBeneficiary) return false;
        const b = this.selectedBeneficiary;
        const f = this.updateForm;

        const dob = b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '';
        const dom = b.dateOfMarriage ? new Date(b.dateOfMarriage).toISOString().split('T')[0] : '';

        return f.name !== b.name ||
            f.mobileNumber !== b.mobileNumber ||
            f.dateOfBirth !== dob ||
            f.gender !== b.gender ||
            f.guardianName !== b.guardianName ||
            f.religion !== b.religion ||
            f.caste !== b.caste ||
            f.qualification !== b.qualification ||
            Number(f.monthlyIncome) !== Number(b.monthlyIncome) ||
            f.primaryIncomeSource !== b.primaryIncomeSource ||
            f.economicStatus !== b.economicStatus ||
            f.employmentStatus !== b.employmentStatus ||
            f.maritalStatus !== b.maritalStatus ||
            f.dateOfMarriage !== dom ||
            Number(f.womanAgeAtMarriage) !== Number(b.womanAgeAtMarriage) ||
            Number(f.husbandAgeAtMarriage) !== Number(b.husbandAgeAtMarriage);
    }

    submitUpdate() {
        const changes: any = {};
        const f = this.updateForm;
        const b = this.selectedBeneficiary;

        if (f.name !== b.name) changes.name = f.name;
        if (f.mobileNumber !== b.mobileNumber) changes.mobileNumber = f.mobileNumber;

        const dob = b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split('T')[0] : '';
        if (f.dateOfBirth !== dob) changes.dateOfBirth = new Date(f.dateOfBirth).toISOString();

        if (f.gender !== b.gender) changes.gender = f.gender;
        if (f.guardianName !== b.guardianName) changes.guardianName = f.guardianName;
        if (f.religion !== b.religion) changes.religion = f.religion;
        if (f.caste !== b.caste) changes.caste = f.caste;
        if (f.qualification !== b.qualification) changes.qualification = f.qualification;

        if (Number(f.monthlyIncome) !== Number(b.monthlyIncome)) changes.monthlyIncome = Number(f.monthlyIncome);
        if (f.primaryIncomeSource !== b.primaryIncomeSource) changes.primaryIncomeSource = f.primaryIncomeSource;
        if (f.economicStatus !== b.economicStatus) changes.economicStatus = f.economicStatus;
        if (f.employmentStatus !== b.employmentStatus) changes.employmentStatus = f.employmentStatus;

        if (f.maritalStatus !== b.maritalStatus) changes.maritalStatus = f.maritalStatus;

        const dom = b.dateOfMarriage ? new Date(b.dateOfMarriage).toISOString().split('T')[0] : '';
        if (f.dateOfMarriage !== dom && f.maritalStatus === 'MARRIED') changes.dateOfMarriage = new Date(f.dateOfMarriage).toISOString();
        if (Number(f.womanAgeAtMarriage) !== Number(b.womanAgeAtMarriage) && f.maritalStatus === 'MARRIED') changes.womanAgeAtMarriage = Number(f.womanAgeAtMarriage);
        if (Number(f.husbandAgeAtMarriage) !== Number(b.husbandAgeAtMarriage) && f.maritalStatus === 'MARRIED') changes.husbandAgeAtMarriage = Number(f.husbandAgeAtMarriage);

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
            },
            error: (err) => {
                toast.error(err.error?.message || 'Failed to submit request');
            }
        });
    }
}
