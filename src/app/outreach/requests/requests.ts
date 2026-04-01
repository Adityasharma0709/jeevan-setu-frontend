import { Component } from '@angular/core';
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

@Component({
    selector: 'app-outreach-requests',
    standalone: true,
    imports: [
        CommonModule,
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
}
