import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';

import { ManagerBeneficiary, ManagerService } from '../../manager.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-beneficiary-detail',
  standalone: true,
  imports: [
    CommonModule,
    ZardButtonComponent,
    ZardIconComponent,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
  ],
  templateUrl: './beneficiary-detail.html',
})
export class BeneficiaryDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private managerService = inject(ManagerService);
  private cdr = inject(ChangeDetectorRef);

  beneficiary: ManagerBeneficiary | null = null;
  loading = true;

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.loading = false;
      return;
    }

    // Try to get data from router state first
    const state = history.state?.beneficiary;
    if (state && state.id === Number(id)) {
      this.beneficiary = state;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    // Fallback: Fetch from API
    this.fetchBeneficiary(Number(id));
  }

  private fetchBeneficiary(id: number): void {
    this.loading = true;
    this.managerService.getBeneficiary(id).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.beneficiary = data;
      },
      error: () => {
        toast.error('Beneficiary not found');
        this.goBack();
      }
    });
  }

  getLocationPart(val: any): string {
    if (!val) return '-';
    return (val?.name || val).toString();
  }

  get beneficiaryAge(): number | string {
    if (!this.beneficiary?.dateOfBirth) return '-';
    const dob = new Date(this.beneficiary.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  get isPriority(): boolean {
    if (!this.beneficiary) return false;
    // Guess based on data presence
    return !!(this.beneficiary.guardianName || this.beneficiary.qualification || this.beneficiary.religion || this.beneficiary.caste);
  }

  goBack(): void {
    this.router.navigate(['/manager/beneficiaries']);
  }
}
