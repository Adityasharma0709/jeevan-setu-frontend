import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { AdminService } from '../admin.service';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay, tap } from 'rxjs';
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
    private cdr: ChangeDetectorRef
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
    this.adminService.getBeneficiaryRequests().subscribe({
      next: (requests) => {
        const safeRequests = Array.isArray(requests) ? requests : [];
        const sorted = safeRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  approve(requestId: number, requestType?: string) {
    const isWorkerRequest = requestType && (requestType.includes('WORKER') || requestType === 'ACTIVATE' || requestType === 'DEACTIVATE');
    const obs = isWorkerRequest
      ? this.adminService.approveAccountRequest(requestId)
      : this.adminService.approveBeneficiaryRequest(requestId);

    obs.subscribe({
      next: () => {
        toast.success('Request approved successfully');
        this.loadRequests();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  reject(requestId: number, requestType?: string) {
    const reason = prompt('Enter rejection reason (optional):') || undefined;
    const isWorkerRequest = requestType && (requestType.includes('WORKER') || requestType === 'ACTIVATE' || requestType === 'DEACTIVATE');
    const obs = isWorkerRequest
      ? this.adminService.rejectAccountRequest(requestId, reason)
      : this.adminService.rejectBeneficiaryRequest(requestId, reason);

    obs.subscribe({
      next: () => {
        toast.success('Request rejected successfully');
        this.loadRequests();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to reject request');
      }
    });
  }

  getPayloadEntries(request: any): Array<{ key: string; label: string; value: string }> {
    const rawPayload = request?.payload ?? request?.data ?? {};
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

    // Prefer nested shapes when backend wraps the payload.
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
      return JSON.stringify(value);
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
