import { Router } from '@angular/router';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManagerBeneficiary, ManagerService } from '../manager.service';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
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

@Component({
    selector: 'app-beneficiaries',
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
        ZardButtonComponent,
        LottieComponent,
    ],
    templateUrl: './beneficiaries.html'
})
export class Beneficiaries implements OnInit {
    beneficiaries: ManagerBeneficiary[] = [];
    isLoading = true;
    readonly loadingOptions: AnimationOptions = { path: '/loading.json' };

    readonly pageSize = 10;
    private readonly page$ = new BehaviorSubject<number>(1);
    private lastPage = 1;
    private lastTotalPages = 1;

    private readonly refresh$ = new BehaviorSubject<void>(undefined);
    pager$!: Observable<{
        items: ManagerBeneficiary[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        from: number;
        to: number;
    }>;

    private router = inject(Router);

    constructor(
        private managerService: ManagerService,
        private cdr: ChangeDetectorRef
    ) {
        this.initPager();
    }

    private initPager() {
        const baseBeneficiaries$ = this.refresh$.pipe(
            tap(() => this.isLoading = true),
            switchMap(() => this.managerService.getBeneficiaries()),
            map((data: any) => Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])),
            tap(() => this.isLoading = false),
            shareReplay({ bufferSize: 1, refCount: true })
        );

        this.pager$ = combineLatest([baseBeneficiaries$, this.page$]).pipe(
            map(([beneficiaries, page]) => {
                const total = (beneficiaries || []).length;
                const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
                const safePage = Math.min(Math.max(1, page), totalPages);

                const startIndex = (safePage - 1) * this.pageSize;
                const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
                const items = (beneficiaries || []).slice(startIndex, endIndexExclusive);

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
                this.cdr.detectChanges();
            }),
            shareReplay({ bufferSize: 1, refCount: true })
        );
    }

    ngOnInit() {
        // No manual trigger needed, pager$ is an observable
    }

    loadBeneficiaries() {
        this.refresh$.next();
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

    viewDetails(beneficiary: ManagerBeneficiary): void {
        this.router.navigate(['/manager/beneficiaries', beneficiary.id], { state: { beneficiary } });
    }

    trackById(_: number, item: ManagerBeneficiary) {
        return item.id;
    }
}
