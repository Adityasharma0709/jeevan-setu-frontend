import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutreachService } from '../outreach.service';
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
export class Requests implements OnInit {
    myRequests: any[] = [];
    isLoading = true;
    options: AnimationOptions = { path: '/loading.json' };

    constructor(private outreachService: OutreachService) { }

    ngOnInit() {
        this.loadMyRequests();
    }

    loadMyRequests() {
        this.isLoading = true;
        this.outreachService.getMyRequests().subscribe({
            next: (data) => {
                this.myRequests = data;
                this.isLoading = false;
            },
            error: (err) => {
                toast.error('Failed to load requests');
                this.isLoading = false;
                console.error(err);
            }
        });
    }

    getChangedKeys(changes: any): string[] {
        return Object.keys(changes || {});
    }
}
