import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZardIconComponent } from '@/shared/components/icon';
import { EpisodeOfCare } from '../../models/dashboard.types';

@Component({
  selector: 'app-episode-card',
  standalone: true,
  imports: [CommonModule, ZardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50/50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-between hover:shadow-md hover:bg-slate-100/50 transition-all duration-300 shadow-sm relative group h-full">
        <!-- Card Header: Title and Icon -->
        <div class="flex items-center gap-3 w-full mb-6">
            <div class="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-110">
                <z-icon [zType]="data.icon" class="w-4 h-4"></z-icon>
            </div>
            <h4 class="text-sm font-bold text-gray-800 tracking-wide line-clamp-1">{{data.label}}</h4>
        </div>

        <!-- Pie/Donut Chart -->
        <div class="relative w-28 h-28 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform duration-300 cursor-pointer mb-6" [style.background]="conicGradient">
            <!-- Inner white circle to construct the donut chart -->
            <div class="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                <span class="text-2xl font-black text-gray-800 mt-0.5">{{data.total}}</span>
            </div>
        </div>

        <!-- Gender Breakdown Details -->
        <div class="w-full space-y-2 pt-4 border-t border-gray-100 mt-auto">
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] block"></span>
                    <span>Male</span>
                </div>
                <span class="font-bold text-gray-800">{{data.male}}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#F43F5E] block"></span>
                    <span>Female</span>
                </div>
                <span class="font-bold text-gray-800">{{data.female}}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B] block"></span>
                    <span>Others</span>
                </div>
                <span class="font-bold text-gray-800">{{data.others}}</span>
            </div>
        </div>
    </div>
  `
})
export class EpisodeCardComponent {
  @Input({ required: true }) data!: EpisodeOfCare;

  get conicGradient(): string {
    const total = this.data.total || 0;
    if (total === 0) {
      return 'conic-gradient(#E5E7EB 0% 100%)';
    }
    const pMale = (this.data.male / total) * 100;
    const pFemale = (this.data.female / total) * 100;
    const stop1 = pMale;
    const stop2 = pMale + pFemale;
    return `conic-gradient(#0EA5E9 0% ${stop1}%, #F43F5E ${stop1}% ${stop2}%, #F59E0B ${stop2}% 100%)`;
  }
}
