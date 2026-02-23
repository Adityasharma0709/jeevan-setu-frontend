import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutreachService, Beneficiary } from '../outreach.service';
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
import { ZardButtonComponent } from '@/shared/components/button';

@Component({
    selector: 'app-beneficiary-search',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ZardTableComponent,
        ZardTableHeaderComponent,
        ZardTableBodyComponent,
        ZardTableRowComponent,
        ZardTableHeadComponent,
        ZardTableCellComponent,
        ZardIconComponent,
        ZardButtonComponent
    ],
    templateUrl: './search.html'
})
export class Search {
    searchQuery = '';
    results: Beneficiary[] = [];
    loading = false;
    searched = false;

    constructor(private outreachService: OutreachService, private router: Router) { }

    search() {
        if (!this.searchQuery.trim()) return;

        this.loading = true;
        this.searched = false;

        this.outreachService.getBeneficiaries(this.searchQuery).subscribe({
            next: (data) => {
                this.results = data;
                this.loading = false;
                this.searched = true;
            },
            error: (err) => {
                toast.error('Search failed');
                console.error(err);
                this.loading = false;
                this.searched = true;
            }
        });
    }

    viewProfile(ben: Beneficiary) {
        this.router.navigate(['/outreach/beneficiary', ben.id], { state: { beneficiary: ben } });
    }
}
