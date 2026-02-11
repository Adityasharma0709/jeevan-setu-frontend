import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AdminService } from '../admin.service';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ZardIconComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats$!: Observable<any>;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
    this.stats$ = this.adminService.getAdminDashboard();
  }
}
