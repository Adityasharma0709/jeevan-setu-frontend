import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ManagerService } from '../manager.service';
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
  selector: 'app-requests',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit {
  incomingRequests: any[] = [];
  myRequests: any[] = [];
  isLoading = true;
  options: AnimationOptions = { path: '/loading.json' };

  constructor(
    private managerService: ManagerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadIncomingRequests();
    this.loadMyRequests();
  }

  loadIncomingRequests() {
    this.managerService.getBeneficiaryRequests().subscribe({
      next: (requests) => {
        console.log('[Manager Incoming Beneficiary Requests API]', requests);
        const safeRequests = Array.isArray(requests) ? requests : [];
        this.incomingRequests = safeRequests
          .filter((request) => String(request?.status || 'PENDING').toUpperCase() === 'PENDING')
          .map((request) => this.normalizeIncomingRequest(request));
        console.log('[Manager Incoming Beneficiary Requests Normalized]', this.incomingRequests);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.incomingRequests = [];
        this.isLoading = false;
        this.cdr.detectChanges();
        toast.error('Failed to load incoming requests');
      }
    });
  }

  approveIncoming(request: any) {
    this.managerService.approveBeneficiaryRequest(request.id).subscribe({
      next: () => {
        toast.success('Request approved successfully');
        this.loadIncomingRequests();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  rejectIncoming(request: any) {
    const reason = prompt('Enter rejection reason (optional):') || undefined;
    this.managerService.rejectBeneficiaryRequest(request.id, reason).subscribe({
      next: () => {
        toast.success('Request rejected successfully');
        this.loadIncomingRequests();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to reject request');
      }
    });
  }

  loadMyRequests() {
    this.managerService.getMyRequests().subscribe({
      next: (requests) => {
        console.log('[Manager My Requests API]', requests);
        const safeRequests = Array.isArray(requests) ? requests : [];
        this.myRequests = safeRequests.map((request) => ({
          ...request,
          type: this.getRequestType(request),
          sentTo: request?.targetAdmin?.name || request?.targetAdmin?.email || 'Admin',
          createdAt: request?.createdAt || new Date().toISOString(),
        }));
        console.log('[Manager My Requests Normalized]', this.myRequests);
        this.cdr.detectChanges();
      },
      error: () => {
        this.myRequests = [];
        this.cdr.detectChanges();
        toast.error('Failed to load your request history');
      }
    });
  }

  private normalizeIncomingRequest(request: any): any {
    const payload = request?.payload || request?.data || {};
    const type = this.getRequestType(request);
    const workerName = request?.requestedBy?.name || request?.outreachWorker?.name || 'Unknown';
    const workerEmail = request?.requestedBy?.email || request?.outreachWorker?.email || '-';
    const beneficiaryId = payload?.beneficiaryId || request?.beneficiaryId || '-';
    const changesPreview = this.buildChangesPreview(payload?.changes || payload?.data || {});

    return {
      ...request,
      workerName,
      workerEmail,
      type,
      beneficiaryId,
      changesPreview,
      createdAt: request?.createdAt || request?.requestedAt || new Date().toISOString(),
    };
  }

  private getRequestType(request: any): string {
    const rawType = String(request?.type || request?.requestType || '').toUpperCase();
    if (['EMAIL', 'EMAIL_UPDATE', 'UPDATE_EMAIL'].includes(rawType)) return 'EMAIL_UPDATE';
    if (['MOBILE', 'MOBILE_UPDATE', 'UPDATE_MOBILE'].includes(rawType)) return 'MOBILE_UPDATE';
    if (rawType.includes('UPDATE_BENEFICIARY') || rawType.includes('MODIFY_BENEFICIARY')) return 'BENEFICIARY_UPDATE';
    if (rawType.includes('PROFILE') || rawType.includes('MODIFY')) return 'PROFILE_UPDATE';
    if (rawType.includes('CREATE')) return 'CREATE_REQUEST';
    if (rawType.includes('DEACTIVATE')) return 'DEACTIVATE_REQUEST';
    return rawType || 'REQUEST';
  }

  getTypeBadgeClass(type: string): string {
    if (type === 'EMAIL_UPDATE') return 'bg-blue-100 text-blue-700';
    if (type === 'MOBILE_UPDATE') return 'bg-purple-100 text-purple-700';
    if (type === 'PROFILE_UPDATE') return 'bg-amber-100 text-amber-700';
    if (type === 'BENEFICIARY_UPDATE') return 'bg-sky-100 text-sky-700';
    if (type === 'CREATE_REQUEST') return 'bg-green-100 text-green-700';
    if (type === 'DEACTIVATE_REQUEST') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  }

  getDetailsText(request: any): string {
    const payload = request?.payload || request?.data || {};
    const reason = request?.reason || payload?.reason;
    return reason ? `Reason: ${reason}` : '';
  }

  private updateStatus(id: number, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const request = this.incomingRequests.find(r => r.id === id);

    this.managerService.updateRequestStatus(id, status, reason).subscribe({
      next: () => {
        toast.success(`Request ${status.toLowerCase()} successfully`);

        if (request) {
          const processedRequest = {
            ...request,
            status: status,
            remarks: reason,
            sentTo: 'Me',
            createdAt: new Date().toISOString()
          };
          this.myRequests = [processedRequest, ...this.myRequests];
        }

        this.loadIncomingRequests(); // Refetch pending
        // this.loadMyRequests(); // Removed to prevent overwrite
      },
      error: (err) => {
        toast.error(err.error?.message || 'Action failed');
      }
    });
  }

  getBeneficiaryLabel(request: any): string {
    const id = request?.beneficiaryId || request?.payload?.beneficiaryId || '-';
    return `Beneficiary #${id}`;
  }

  getChangesPreview(request: any): string {
    return request?.changesPreview || '-';
  }

  private buildChangesPreview(changes: Record<string, any>): string {
    if (!changes || typeof changes !== 'object') return '-';

    const entries = Object.entries(changes).filter(([, value]) => {
      return value !== undefined && value !== null && value !== '';
    });

    if (entries.length === 0) return '-';

    const formatted = entries.slice(0, 3).map(([key, value]) => {
      const label = this.formatFieldLabel(key);
      return `${label}: ${this.formatValue(value)}`;
    });

    const remaining = entries.length - 3;
    return remaining > 0 ? `${formatted.join(', ')} +${remaining} more` : formatted.join(', ');
  }

  private formatFieldLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  getStatusBadgeClass(status: string): string {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'APPROVED') return 'bg-green-100 text-green-700';
    if (normalized === 'REJECTED') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }
}
