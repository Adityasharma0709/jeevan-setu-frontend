import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, combineLatest, forkJoin, map, shareReplay, switchMap, tap } from 'rxjs';
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

  readonly pageSize = 10;
  private readonly incomingPage$ = new BehaviorSubject<number>(1);
  private lastIncomingPage = 1;
  private lastIncomingTotalPages = 1;

  private readonly myPage$ = new BehaviorSubject<number>(1);
  private lastMyPage = 1;
  private lastMyTotalPages = 1;

  private readonly refreshIncoming$ = new BehaviorSubject<void>(undefined);
  private readonly refreshMy$ = new BehaviorSubject<void>(undefined);

  incomingPager$!: Observable<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;

  myPager$!: Observable<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;

  constructor(
    private managerService: ManagerService,
    private cdr: ChangeDetectorRef
  ) {
    this.initPagers();
  }

  private initPagers() {
    const baseIncoming$ = this.refreshIncoming$.pipe(
      tap(() => this.isLoading = true),
      switchMap(() => forkJoin({
        beneficiary: this.managerService.getBeneficiaryRequests(),
        profile: this.managerService.getPendingRequests()
      })),
      map((res: any) => {
        const ben = Array.isArray(res.beneficiary) ? res.beneficiary : [];
        const prof = Array.isArray(res.profile) ? res.profile : [];
        const requests = [...ben, ...prof];
        return requests
          .filter((request) => String(request?.status || 'PENDING').toUpperCase() === 'PENDING')
          .map((request) => this.normalizeIncomingRequest(request))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
      tap(() => this.isLoading = false),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.incomingPager$ = combineLatest([baseIncoming$, this.incomingPage$]).pipe(
      map(([requests, page]) => {
        const total = requests.length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const startIndex = (safePage - 1) * this.pageSize;
        const items = requests.slice(startIndex, startIndex + this.pageSize);
        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : Math.min(startIndex + this.pageSize, total);
        return { items, page: safePage, pageSize: this.pageSize, total, totalPages, from, to };
      }),
      tap((vm) => {
        this.lastIncomingPage = vm.page;
        this.lastIncomingTotalPages = vm.totalPages;
        this.cdr.detectChanges();
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    const baseMy$ = this.refreshMy$.pipe(
      switchMap(() => this.managerService.getMyRequests()),
      map((requests: any) => {
        const safeRequests = Array.isArray(requests) ? requests : [];
        return safeRequests.map((request: any) => ({
          ...request,
          type: this.getRequestType(request),
          sentTo: request?.targetAdmin?.name || request?.targetAdmin?.email || 'Admin',
          createdAt: request?.createdAt || new Date().toISOString(),
          payloadText: this.getPayloadText(request),
        }));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.myPager$ = combineLatest([baseMy$, this.myPage$]).pipe(
      map(([requests, page]) => {
        const total = requests.length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const startIndex = (safePage - 1) * this.pageSize;
        const items = requests.slice(startIndex, startIndex + this.pageSize);
        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : Math.min(startIndex + this.pageSize, total);
        return { items, page: safePage, pageSize: this.pageSize, total, totalPages, from, to };
      }),
      tap((vm) => {
        this.lastMyPage = vm.page;
        this.lastMyTotalPages = vm.totalPages;
        this.cdr.detectChanges();
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  ngOnInit() {
    // Pagers initialization handles logic
  }

  loadIncomingRequests() {
    this.refreshIncoming$.next();
  }

  loadMyRequests() {
    this.refreshMy$.next();
  }

  goToIncomingPage(page: number) {
    this.incomingPage$.next(Math.max(1, Math.floor(Number(page) || 1)));
  }

  prevIncomingPage() {
    this.incomingPage$.next(Math.max(1, this.lastIncomingPage - 1));
  }

  nextIncomingPage() {
    this.incomingPage$.next(Math.min(this.lastIncomingTotalPages, this.lastIncomingPage + 1));
  }

  goToMyPage(page: number) {
    this.myPage$.next(Math.max(1, Math.floor(Number(page) || 1)));
  }

  prevMyPage() {
    this.myPage$.next(Math.max(1, this.lastMyPage - 1));
  }

  nextMyPage() {
    this.myPage$.next(Math.min(this.lastMyTotalPages, this.lastMyPage + 1));
  }

  approveIncoming(request: any) {
    const ob$ = request.type === 'BENEFICIARY_UPDATE'
      ? this.managerService.approveBeneficiaryRequest(request.id)
      : this.managerService.updateRequestStatus(request.id, 'APPROVED');

    ob$.subscribe({
      next: () => {
        toast.success('Request approved successfully');
        this.loadIncomingRequests();
      },
      error: (err: any) => {
        toast.error(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  rejectIncoming(request: any) {
    const reason = prompt('Enter rejection reason (optional):') || undefined;
    const ob$ = request.type === 'BENEFICIARY_UPDATE'
      ? this.managerService.rejectBeneficiaryRequest(request.id, reason)
      : this.managerService.updateRequestStatus(request.id, 'REJECTED', reason);

    ob$.subscribe({
      next: () => {
        toast.success('Request rejected successfully');
        this.loadIncomingRequests();
      },
      error: (err: any) => {
        toast.error(err?.error?.message || 'Failed to reject request');
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
      changes: payload?.changes || payload?.data || payload || {},
      payloadText: this.getPayloadText(request),
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

  getBeneficiaryLabel(request: any): string {
    const id = request?.beneficiaryId || request?.payload?.beneficiaryId || '-';
    return `Beneficiary #${id}`;
  }

  getChangesPreview(request: any): string {
    return request?.changesPreview || '-';
  }

  getPayloadText(request: any): string {
    const payload = request?.payload || request?.data || {};
    if (payload == null) return '-';

    if (typeof payload === 'string') {
      return payload.trim() || '-';
    }

    if (typeof payload !== 'object') {
      return String(payload);
    }

    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return '-';
    }
  }

  getPayloadEntries(request: any): Array<{ key: string; label: string; value: string }> {
    const rawPayload = request?.payload || request?.data || {};
    const payload = this.extractDisplayPayload(rawPayload);

    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload)) {
      return payload.map((v, idx) => ({
        key: String(idx),
        label: `#${idx + 1}`,
        value: this.formatPayloadValue(String(idx), v),
      }));
    }

    return Object.entries(payload as Record<string, unknown>).map(([key, value]) => ({
      key,
      label: this.formatFieldLabel(key),
      value: this.formatPayloadValue(key, value),
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

  private formatPayloadValue(key: string, value: unknown): string {
    const k = (key ?? '').toString().toLowerCase();
    if (k.includes('password')) return '********';
    return this.formatValue(value);
  }

  getChangedKeys(changes: any): string[] {
    if (!changes || typeof changes !== 'object') return [];
    return Object.keys(changes).filter(key => key !== 'reason' && key !== 'id' && key !== 'beneficiaryId');
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

  public formatFieldLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  public formatValue(value: any): string {
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
