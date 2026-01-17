import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],   // 🔥 REQUIRED for *ngFor
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit {

  stats: any;   // 👈 correct variable

  constructor(private api: DashboardService) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.api.getSuperAdminStats()
      .subscribe(res => {
        console.log(res); // 👈 working
        this.stats = res; //✅ FIXED
      });
  }
}
