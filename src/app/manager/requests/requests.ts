import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';
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
    ZardIconComponent
  ],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit {
  requests: any[] = [];
  myRequests: any[] = [];

  constructor(
    private managerService: ManagerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadRequests();
    this.loadMyRequests();
  }

  loadRequests() {
    this.managerService.getPendingRequests().subscribe({
      next: (requests) => {
        console.log('[Manager Pending Requests API]', requests);
        const safeRequests = Array.isArray(requests) ? requests : [];
        this.requests = safeRequests
          .filter((request) => String(request?.status || 'PENDING').toUpperCase() === 'PENDING')
          .map((request) => this.normalizeRequest(request));
        console.log('[Manager Pending Requests Normalized]', this.requests);
        this.cdr.detectChanges();
      },
      error: () => {
        this.requests = [];
        this.cdr.detectChanges();
        toast.error('Failed to load requests');
      }
    });
  }

  approve(request: any) {
    this.updateStatus(request.id, 'APPROVED');
  }

  reject(request: any) {
    const reason = prompt('Enter rejection reason (optional):') || undefined;
    this.updateStatus(request.id, 'REJECTED', reason);
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

  private normalizeRequest(request: any): any {
    const payload = request?.payload || request?.data || {};
    const type = this.getRequestType(request);
    const workerName =
      request?.workerName ||
      request?.requestedBy?.name ||
      request?.outreachWorker?.name ||
      request?.user?.name ||
      'Unknown';

    let currentValue =
      request?.currentValue ||
      payload?.currentValue ||
      payload?.current ||
      payload?.oldValue ||
      '-';

    let newValue =
      request?.newValue ||
      payload?.newValue ||
      payload?.new ||
      payload?.value ||
      '-';

    if (type === 'PROFILE_UPDATE') {
      const updates: string[] = [];
      if (payload?.name) updates.push(`Name: ${payload.name}`);
      if (payload?.mobile || payload?.mobileNumber) {
        updates.push(`Mobile: ${payload.mobile || payload.mobileNumber}`);
      }
      if (updates.length) {
        currentValue = 'Profile details';
        newValue = updates.join(', ');
      }
    }

    return {
      ...request,
      workerName,
      type,
      currentValue,
      newValue,
      reason: payload?.reason || request?.reason || '',
      createdAt: request?.createdAt || request?.requestedAt || new Date().toISOString(),
    };
  }

  private getRequestType(request: any): string {
    const rawType = String(request?.type || request?.requestType || '').toUpperCase();
    if (['EMAIL', 'EMAIL_UPDATE', 'UPDATE_EMAIL'].includes(rawType)) return 'EMAIL_UPDATE';
    if (['MOBILE', 'MOBILE_UPDATE', 'UPDATE_MOBILE'].includes(rawType)) return 'MOBILE_UPDATE';
    if (rawType.includes('PROFILE') || rawType.includes('MODIFY')) return 'PROFILE_UPDATE';
    if (rawType.includes('CREATE')) return 'CREATE_REQUEST';
    if (rawType.includes('DEACTIVATE')) return 'DEACTIVATE_REQUEST';
    return rawType || 'REQUEST';
  }

  getTypeBadgeClass(type: string): string {
    if (type === 'EMAIL_UPDATE') return 'bg-blue-100 text-blue-700';
    if (type === 'MOBILE_UPDATE') return 'bg-purple-100 text-purple-700';
    if (type === 'PROFILE_UPDATE') return 'bg-amber-100 text-amber-700';
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
    const request = this.requests.find(r => r.id === id);

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

        this.loadRequests(); // Refetch pending
        // this.loadMyRequests(); // Removed to prevent overwrite
      },
      error: (err) => {
        toast.error(err.error?.message || 'Action failed');
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'APPROVED') return 'bg-green-100 text-green-700';
    if (normalized === 'REJECTED') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }
}
