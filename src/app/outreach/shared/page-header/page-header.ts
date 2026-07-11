import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-outreach-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.html',
})
export class OutreachPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly mobileTitle = input<string>('');
  readonly mobileSubtitle = input<string>('');
  readonly showSearch = input(false);
  readonly showMobileExtras = input(false);
}
