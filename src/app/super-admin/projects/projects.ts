import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { Observable } from 'rxjs';
import {  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableCaptionComponent } from '@/shared/components/table';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule,
    ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableCaptionComponent 
  ],
  templateUrl: './projects.html'
})
export class ProjectsComponent {

  projects$!: Observable<any>;

  constructor(private api: ApiService) {
    // 🔥 Auto API call
    this.projects$ = this.api.get('projects');
  }
}
