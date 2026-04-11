import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ZardToastComponent } from '@/shared/components/toast/toast.component';
import { TabTitleService } from './core/services/tab-title.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,ZardToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(private readonly tabTitleService: TabTitleService) {
    this.tabTitleService.init();
  }
}
