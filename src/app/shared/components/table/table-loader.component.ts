import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'z-table-loader',
  standalone: true,
  imports: [CommonModule, LottieComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      *ngIf="zLoading()"
      class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center transition-all duration-200"
      [ngClass]="zClass()"
    >
      <ng-lottie [options]="lottieOptions" [height]="zSize() + 'px'" [width]="zSize() + 'px'"></ng-lottie>
      <p *ngIf="zText()" class="-mt-2 text-xs font-bold text-white tracking-wider uppercase drop-shadow-sm select-none">
        {{ zText() }}
      </p>
    </div>
  `,
  host: {
    class: 'contents',
  },
  exportAs: 'zTableLoader',
})
export class ZardTableLoaderComponent {
  readonly zLoading = input<boolean | null>(false);
  readonly zText = input<string>('Loading...');
  readonly zSize = input<number>(90);
  readonly zClass = input<string>('');
  readonly lottieOptions: AnimationOptions = { path: '/loadingcircle.json' };
}
