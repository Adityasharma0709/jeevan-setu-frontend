import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutreachService } from '../outreach.service';
import { toast } from 'ngx-sonner';
import { catchError, combineLatest, map, Observable, of, shareReplay, startWith, BehaviorSubject, Subject, switchMap } from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import {
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardAlertDialogService } from '@/shared/components/alert-dialog';

@Component({
    selector: 'app-outreach-requests',
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
    templateUrl: './requests.html'
})
export class Requests {
    private readonly alertDialog = inject(ZardAlertDialogService);

    // ── Loader ──────────────────────────────────────────────────────────────
    options: AnimationOptions = { path: '/loading.json' };

    // ── Pagination ──────────────────────────────────────────────────────────
    readonly pageSize = 10;
    private readonly page$ = new BehaviorSubject<number>(1);
    private readonly refresh$ = new Subject<void>();
    private lastPage = 1;
    private lastPageCount = 1;

    readonly vm$: Observable<{
        items: any[];
        total: number;
        page: number;
        pageCount: number;
        startIndex: number;
        endIndex: number;
        pageSize: number;
    }> = combineLatest([
        this.refresh$.pipe(startWith(void 0), switchMap(() => this.outreachService.getMyRequests())),
        this.page$.asObservable()
    ]).pipe(
        map(([data, page]) => {
            const requests = Array.isArray(data) ? data.map(req => this.normalizeRequest(req)) : [];
            const total = requests.length;
            const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
            const safePage = Math.min(Math.max(1, page), pageCount);
            const startIndex = (safePage - 1) * this.pageSize;
            const items = requests.slice(startIndex, startIndex + this.pageSize);

            this.lastPage = safePage;
            this.lastPageCount = pageCount;

            return {
                items,
                total,
                page: safePage,
                pageCount,
                startIndex,
                endIndex: Math.min(startIndex + this.pageSize, total),
                pageSize: this.pageSize
            };
        }),
        catchError((err) => {
            toast.error('Failed to load requests');
            console.error(err);
            return of({
                items: [],
                total: 0,
                page: 1,
                pageCount: 1,
                startIndex: 0,
                endIndex: 0,
                pageSize: this.pageSize
            });
        }),
        shareReplay(1)
    );

    constructor(private outreachService: OutreachService) { }

    nextPage(): void {
        if (this.lastPage < this.lastPageCount) {
            this.page$.next(this.lastPage + 1);
        }
    }

    prevPage(): void {
        if (this.lastPage > 1) {
            this.page$.next(this.lastPage - 1);
        }
    }

    cancelRequest(request: any): void {
        if (request.status !== 'PENDING') return;

        this.alertDialog.confirm({
            zTitle: 'Cancel Request',
            zDescription: 'Are you sure you want to cancel this request? This action cannot be undone.',
            zOkText: 'Yes, Cancel',
            zCancelText: 'Go Back',
            zOkDestructive: true,
            zOnOk: () => {
                this.outreachService.cancelRequest(request.id).subscribe({
                    next: () => {
                        toast.success('Request cancelled successfully');
                        this.refresh$.next();
                    },
                    error: (err: any) => {
                        toast.error(err?.error?.message || 'Failed to cancel request');
                    }
                });
            }
        });
    }

    getBeneficiaryLabel(request: any): string {
        if (request?.beneficiary?.name) {
            return `${request.beneficiary.name} (${request.beneficiary.uid})`;
        }
        const id = request?.beneficiaryId || request?.payload?.beneficiaryId || '-';
        return id !== '-' ? `Beneficiary #${id}` : '-';
    }

    getChangedKeys(changes: any): string[] {
        if (!changes || typeof changes !== 'object') return [];
        return Object.keys(changes).filter(key => key !== 'reason' && key !== 'id' && key !== 'beneficiaryId' && key !== 'updatedAt' && key !== 'createdAt');
    }

    private normalizeRequest(request: any): any {
        const payload = request?.payload || request?.data || {};
        const changes = payload?.changes || payload?.data || (typeof payload === 'object' && !payload.changes ? payload : {});

        return {
            ...request,
            changes: changes || {},
            payloadText: this.getPayloadText(request),
            createdAt: request?.createdAt || request?.requestedAt || new Date().toISOString(),
        };
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

    getPayloadText(request: any): string {
        const payload = request?.payload || request?.data || {};
        if (payload == null) return '-';
        if (typeof payload === 'string') return payload.trim() || '-';
        if (typeof payload !== 'object') return String(payload);
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
}
