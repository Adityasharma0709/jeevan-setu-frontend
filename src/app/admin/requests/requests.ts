import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { AdminService } from '../admin.service';
import { BehaviorSubject, combineLatest, forkJoin, map, Observable, of, shareReplay, tap, catchError } from 'rxjs';
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
import { ZardAlertDialogService } from '@/shared/components/alert-dialog/alert-dialog.service';
import { FormsModule } from '@angular/forms';
import { RequestCountService } from '../../core/services/request-count.service';

@Component({
  selector: 'app-admin-requests',
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
    FormsModule,
  ],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit {
  pager$!: Observable<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  isLoading = true;
  options: AnimationOptions = { path: '/loading.json' };

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly requests$ = new BehaviorSubject<any[]>([]);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private adminService: AdminService,
    private alertDialog: ZardAlertDialogService,
    private cdr: ChangeDetectorRef,
    private requestCountService: RequestCountService
  ) {
    this.pager$ = combineLatest([this.requests$, this.page$]).pipe(
      map(([requests, page]) => {
        const total = (requests || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (requests || []).slice(startIndex, endIndexExclusive);

        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : endIndexExclusive;

        return {
          items,
          page: safePage,
          pageSize: this.pageSize,
          total,
          totalPages,
          from,
          to,
        };
      }),
      tap((vm) => {
        if (vm.page !== this.page$.getValue()) this.page$.next(vm.page);
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading = true;
    forkJoin({
      beneficiary: this.adminService.getBeneficiaryRequests().pipe(catchError(() => of([]))),
      account: this.adminService.getAccountRequests().pipe(catchError(() => of([])))
    }).subscribe({
      next: (results) => {
        const benReqs = Array.isArray(results.beneficiary) ? results.beneficiary : [];
        const accReqs = Array.isArray(results.account) ? results.account : [];
        const combined = [...benReqs, ...accReqs];
        
        // Deduplicate by ID
        const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
        
        const normalized = unique.map(r => this.normalizeRequest(r));
        const sorted = normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        this.goToPage(1);
        this.requests$.next(sorted);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.goToPage(1);
        this.requests$.next([]);
        this.isLoading = false;
        this.cdr.detectChanges();
        toast.error(err?.error?.message || 'Failed to load requests');
      }
    });
  }

  private normalizeRequest(request: any): any {
    const payload = request?.payload || request?.data || {};
    const type = this.getRequestType(request);
    const requesterName = request?.requestedBy?.name || 'Unknown';
    const requesterEmail = request?.requestedBy?.email || '';
    
    let targetLabel = '-';
    let targetSubLabel = '';

    if (['UPDATE_BENEFICIARY', 'MODIFY_BENEFICIARY', 'BENEFICIARY_UPDATE'].includes(type)) {
      if (request?.beneficiary?.name) {
        targetLabel = request.beneficiary.name;
        targetSubLabel = request.beneficiary.uid ? `UID: ${request.beneficiary.uid}` : '';
      } else {
        const id = payload?.beneficiaryId || request?.beneficiaryId || '-';
        targetLabel = id !== '-' ? `Beneficiary #${id}` : '-';
      }
    } else if (type.includes('WORKER') || type === 'UPDATE_PROFILE' || type === 'PROFILE_UPDATE') {
      const worker = request?.worker || request?.requestedBy; // If it's a profile update, target is requester
      if (worker?.name) {
        targetLabel = worker.name;
        targetSubLabel = worker.email || worker.usercode || '';
      } else if (payload?.name) {
        targetLabel = payload.name;
        targetSubLabel = payload.email || '';
      } else if (payload?.email) {
        targetLabel = payload.email;
      } else {
        targetLabel = 'Account Request';
      }
    }

    const changes = payload?.changes || payload?.data || payload || {};

    return {
      ...request,
      type,
      requesterName,
      requesterEmail,
      targetLabel,
      targetSubLabel,
      changes,
      createdAt: request?.createdAt || new Date().toISOString(),
    };
  }

  private getRequestType(request: any): string {
    const rawType = String(request?.requestType || request?.type || '').toUpperCase();
    return rawType || 'REQUEST';
  }

  approve(requestId: number, requestType?: string) {
    const isWorkerRequest = requestType && (requestType.includes('WORKER') || requestType === 'ACTIVATE' || requestType === 'DEACTIVATE');
    const obs = isWorkerRequest
      ? this.adminService.approveAccountRequest(requestId)
      : this.adminService.approveBeneficiaryRequest(requestId);

    obs.subscribe({
      next: () => {
        toast.success('Request approved successfully');
        this.loadRequests();
        this.requestCountService.refresh();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  reject(requestId: number, requestType?: string, template?: any) {
    let reason = '';
    
    this.alertDialog.create({
      zTitle: 'Reject Request',
      zContent: template,
      zOkText: 'Reject',
      zCancelText: 'Cancel',
      zOkDestructive: true,
      zWidth: '400px',
      zOnOk: () => {
        const isWorkerRequest = requestType && (requestType.includes('WORKER') || requestType === 'ACTIVATE' || requestType === 'DEACTIVATE');
        const obs = isWorkerRequest
          ? this.adminService.rejectAccountRequest(requestId, reason || undefined)
          : this.adminService.rejectBeneficiaryRequest(requestId, reason || undefined);

        obs.subscribe({
          next: () => {
            toast.success('Request rejected successfully');
            this.loadRequests();
            this.requestCountService.refresh();
          },
          error: (err) => {
            toast.error(err?.error?.message || 'Failed to reject request');
          }
        });
      },
      zData: {
        setReason: (val: string) => reason = val
      }
    });
  }

  getPayloadEntries(request: any): any[] {
    const changes = request.changes || {};
    const skipKeys = ['workerId', 'beneficiaryId', 'id', 'projectId', 'locationId', 'requestedById', 'targetAdminId', 'uid', 'usercode'];
    
    return Object.entries(changes)
      .filter(([key, value]) => {
        if (skipKeys.includes(key)) return false;
        return value !== null && value !== undefined && value !== '';
      })
      .map(([key, value]) => ({
        label: this.formatFieldLabel(key),
        value: this.formatPayloadValue(key, value)
      }));
  }

  private extractDisplayPayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const maybeChanges = (payload as any)?.changes;
    if (maybeChanges && typeof maybeChanges === 'object') return maybeChanges;

    const maybeData = (payload as any)?.data;
    if (maybeData && typeof maybeData === 'object') return maybeData;

    return payload;
  }

  private formatFieldLabel(key: string): string {
    return (key ?? '')
      .toString()
      .trim()
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatPayloadValue(key: string, value: unknown): string {
    const k = (key ?? '').toString().toLowerCase();
    if (k.includes('password')) return '********';

    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value.trim() || '-';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    } catch {
      return String(value);
    }
  }

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
  }

  trackById(index: number, item: any): number | string {
    return item.id || index;
  }
}
