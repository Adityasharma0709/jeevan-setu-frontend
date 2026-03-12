import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutreachService } from '../outreach.service';
import { toast } from 'ngx-sonner';
import { catchError, defer, map, Observable, of, shareReplay, startWith } from 'rxjs';
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
    options: AnimationOptions = { path: '/loading.json' };
    readonly state$: Observable<{ status: 'loading' | 'loaded' | 'error'; requests: any[] }> = defer(() =>
        this.outreachService.getMyRequests().pipe(
            map((data) => (Array.isArray(data) ? data : [])),
            map((requests) => ({ status: 'loaded' as const, requests })),
            catchError((err) => {
                toast.error('Failed to load requests');
                console.error(err);
                return of({ status: 'error' as const, requests: [] as any[] });
            }),
            startWith({ status: 'loading' as const, requests: [] as any[] }),
            shareReplay(1)
        )
    );

    constructor(private outreachService: OutreachService) { }

    getChangedKeys(changes: any): string[] {
        return Object.keys(changes || {});
    }
}
