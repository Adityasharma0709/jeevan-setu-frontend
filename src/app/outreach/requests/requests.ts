import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutreachService } from '../outreach.service';
import { toast } from 'ngx-sonner';
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
        ZardIconComponent
    ],
    templateUrl: './requests.html'
})
export class Requests implements OnInit {
    myRequests: any[] = [];

    constructor(private outreachService: OutreachService) { }

    ngOnInit() {
        this.loadMyRequests();
    }

    loadMyRequests() {
        this.outreachService.getMyRequests().subscribe({
            next: (data) => {
                this.myRequests = data;
            },
            error: (err) => {
                toast.error('Failed to load requests');
                console.error(err);
            }
        });
    }

    getChangedKeys(changes: any): string[] {
        return Object.keys(changes || {});
    }
}
