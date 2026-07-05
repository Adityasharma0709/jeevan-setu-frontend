import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZardIconComponent, type ZardIcon } from '@/shared/components/icon';
import { ActivityStat } from '../../models/dashboard.types';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [CommonModule, ZardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'border rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 hover:shadow-md shadow-sm h-full group ' + activityBgClass">
        <div class="w-10 h-10 rounded-full bg-white/85 flex items-center justify-center shadow-inner mb-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
            <z-icon [zType]="activityIcon" class="w-5 h-5 opacity-90"></z-icon>
        </div>
        <h3 class="text-3xl md:text-4xl font-black mb-2 tracking-tight">{{data.count}}</h3>
        <p class="text-[10px] font-extrabold uppercase tracking-widest leading-snug opacity-80 mb-0">{{data.label}}</p>
    </div>
  `
})
export class ActivityCardComponent {
  @Input({ required: true }) data!: ActivityStat;

  get activityIcon(): ZardIcon {
    const l = (this.data.label || '').toUpperCase();
    if (l.includes('STAKEHOLDER')) return 'users';
    if (l.includes('SAM') || l.includes('MAM')) return 'circle-alert';
    if (l.includes('PREGNANT') || l.includes('LACTATING') || l.includes('MARRIED')) return 'heart';
    return 'user';
  }

  get activityBgClass(): string {
    const l = (this.data.label || '').toUpperCase();
    if (l.includes('SAM')) return 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100/50';
    if (l.includes('MAM')) return 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100/50';
    if (l.includes('PREGNANT') || l.includes('LACTATING')) return 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100/50';
    if (l.includes('STAKEHOLDER')) return 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50';
    if (l.includes('BOYS')) return 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100/50';
    if (l.includes('GIRLS')) return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50';
    return 'bg-slate-50/80 text-slate-700 border-slate-100 hover:bg-slate-100/50';
  }
}
