import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AdminService } from '../admin.service';
import { AuthService } from '../../core/services/auth';
import { ZardIconComponent } from '@/shared/components/icon';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ZardIconComponent, LottieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats$!: Observable<any>;
  assignedProjects$!: Observable<any[]>;
  options: AnimationOptions = { path: '/loading.json' };

  constructor(
    private adminService: AdminService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = Number(currentUser?.sub) || undefined;
    this.stats$ = this.adminService.getAdminDashboard();
    this.assignedProjects$ = this.adminService.getAssignedProjects(currentUserId);
  }
}
