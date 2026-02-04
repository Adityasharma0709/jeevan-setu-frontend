import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from './dashboard.service';
import { Observable } from 'rxjs';
import {  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent} from '@/shared/components/table/table.component'
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule,
    ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent
  ],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {

  stats$!: Observable<any>;   // 👈 Observable

  constructor(private api: DashboardService) {
    this.stats$ = this.api.getSuperAdminStats(); // auto call
  }
}
