import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription, combineLatest, debounceTime, distinctUntilChanged, map, startWith, Subject, switchMap, BehaviorSubject, shareReplay } from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective } from '@/shared/components/input';
import {
  ZardTableBodyComponent,
  ZardTableCellComponent,
  ZardTableComponent,
  ZardTableHeadComponent,
  ZardTableHeaderComponent,
  ZardTableRowComponent,
} from '@/shared/components/table';

import {
  Beneficiary,
  OutreachService,
} from '../outreach.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-beneficiaries',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardDialogModule,
    ZardIconComponent,
    ZardInputDirective,
    ZardTableBodyComponent,
    ZardTableCellComponent,
    ZardTableComponent,
    ZardTableHeadComponent,
    ZardTableHeaderComponent,
    ZardTableRowComponent,
    LottieComponent,
  ],
  templateUrl: './beneficiaries.html',
})
export class Beneficiaries implements OnInit, OnDestroy {

  private outreachService = inject(OutreachService);
  private dialog         = inject(ZardDialogService);
  private authService    = inject(AuthService);
  private router         = inject(Router);

  private refresh$       = new Subject<void>();
  private subs           = new Subscription();

  dialogRef!: ZardDialogRef<any>;

  // ── Animations ────────────────────────────────────────────────────────────
  options: AnimationOptions = { path: '/loading.json' };

  // ── Pagination & Search ──────────────────────────────────────────────────
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  searchControl = new FormControl('');
  private lastPage = 1;
  private lastPageCount = 1;

  // ── Reactive streams ──────────────────────────────────────────────────────

  private readonly rawBeneficiaries$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.searchControl.valueChanges.pipe(
        startWith(''), 
        debounceTime(250), 
        distinctUntilChanged(),
        map(s => {
            this.page$.next(1); // Reset to page 1 on search
            return (s || '').trim();
        })
    ),
  ]).pipe(
    switchMap(([_, search]) => this.outreachService.getBeneficiaries(search)),
    map((rows) => Array.isArray(rows) ? rows : []),
    shareReplay(1)
  );

  vm$ = combineLatest([
    this.rawBeneficiaries$,
    this.page$.asObservable(),
  ]).pipe(
    map(([beneficiaries, page]) => {
      const total = beneficiaries.length;
      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: beneficiaries.slice(startIndex, startIndex + this.pageSize),
        total,
        page: safePage,
        pageCount,
        pageSize: this.pageSize,
        startIndex,
        endIndex: Math.min(startIndex + this.pageSize, total)
      };
    })
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  navigateToCreate(): void {
    this.router.navigate(['/outreach/beneficiaries/create']);
  }

  viewDetails(beneficiary: Beneficiary): void {
    this.router.navigate(['/outreach/beneficiary', beneficiary.id], { state: { beneficiary } });
  }

  // ── Pagination Helpers ───────────────────────────────────────────────────

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

  trackById(_: number, item: Beneficiary): number {
    return item.id;
  }
}
