import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZardIconComponent } from '@/shared/components/icon';
import type { ClassValue } from 'clsx';
import { mergeClasses } from '@/shared/utils/merge-classes';

@Component({
  selector: 'z-card',
  standalone: true,
  imports: [CommonModule, ZardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div [class]="cardClasses()">
      <!-- Top header: Label & Arrow button -->
      <div class="flex items-start justify-between w-full mb-3 gap-2">
        <p [class]="titleClasses()">{{ label() }}</p>
        <div [class]="arrowCircleClasses()">
          <z-icon zType="arrow-up-right" size="13" [class]="arrowIconClasses()"></z-icon>
        </div>
      </div>

      <!-- Count / Value -->
      <h3 [class]="countClasses()">{{ count() }}</h3>


    </div>
  `,
})
export class ZardCardComponent {
  readonly label = input<string>('');
  readonly count = input<number | string>(0);
  readonly isSelected = input<boolean>(false);
  readonly trend = input<string>('');
  readonly trendValue = input<string>('');
  readonly trendType = input<'success' | 'danger' | 'info' | 'neutral'>('success');
  readonly class = input<ClassValue>('');

  protected readonly cardClasses = computed(() => {
    const base = 'w-full text-left rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 h-full border select-none';
    const stateClasses = this.isSelected()
      ? 'bg-gradient-to-br from-[#126442] to-[#0A412A] border-transparent shadow-lg shadow-[#0a412a]/10 scale-[1.01]'
      : 'bg-white border-slate-100/90 shadow-sm hover:shadow-md hover:border-slate-200/80';
    return mergeClasses(base, stateClasses, this.class());
  });

  protected readonly titleClasses = computed(() => {
    return this.isSelected()
      ? 'text-xs font-bold uppercase tracking-wider text-emerald-100/90 leading-snug line-clamp-2'
      : 'text-xs font-bold uppercase tracking-wider text-slate-500 leading-snug line-clamp-2';
  });

  protected readonly countClasses = computed(() => {
    return this.isSelected()
      ? 'text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none'
      : 'text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-none';
  });

  protected readonly arrowCircleClasses = computed(() => {
    const base = 'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300';
    const state = this.isSelected()
      ? 'bg-white text-[#0A412A] rotate-45'
      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-350';
    return `${base} ${state}`;
  });

  protected readonly arrowIconClasses = computed(() => {
    return this.isSelected() ? 'text-[#0A412A]' : 'text-slate-700';
  });

  protected readonly trendBadgeClasses = computed(() => {
    const base = 'px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5';
    
    if (this.isSelected()) {
      return `${base} bg-emerald-900/50 border border-emerald-700/50 text-emerald-200`;
    }

    switch (this.trendType()) {
      case 'danger':
        return `${base} bg-rose-50 border border-rose-100 text-rose-700`;
      case 'info':
        return `${base} bg-blue-50 border border-blue-100 text-blue-700`;
      case 'neutral':
        return `${base} bg-slate-100 border border-slate-200 text-slate-600`;
      case 'success':
      default:
        return `${base} bg-emerald-50 border border-emerald-100 text-emerald-700`;
    }
  });

  protected readonly trendTextClasses = computed(() => {
    if (this.isSelected()) {
      return 'text-[11px] text-emerald-200/90 font-medium leading-none';
    }

    switch (this.trendType()) {
      case 'danger':
        return 'text-[11px] text-rose-600 font-medium leading-none';
      case 'info':
        return 'text-[11px] text-blue-600 font-medium leading-none';
      case 'neutral':
        return 'text-[11px] text-slate-500 font-medium leading-none';
      case 'success':
      default:
        return 'text-[11px] text-emerald-700 font-medium leading-none';
    }
  });
}
