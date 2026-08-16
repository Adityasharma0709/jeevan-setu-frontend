import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EpisodeOfCare {
  label: string;
  male: number;
  female: number;
  others: number;
  total: number;
  icon?: any;
}

export interface EpisodeOfCareFemale {
  label: string;
  adolescentGirl: number;
  woman: number;
  children?: number;
  total: number;
  icon?: any;
}

export interface EpisodeOfCareMaleChild {
  label: string;
  men: number;
  adolescentBoy: number;
  children: number;
  total: number;
  icon?: any;
}

// Variant 1: Male, Female, Other
@Component({
  selector: 'z-episode-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50/50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-between hover:shadow-md hover:bg-slate-100/50 transition-all duration-300 shadow-sm relative group h-full">
        <!-- Card Header: Title -->
        <div class="flex items-center gap-3 w-full mb-6">
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
export class ZardEpisodeCardComponent {
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

// Variant 2: Adolescent Girl and Woman
@Component({
  selector: 'z-episode-card-female',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50/50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-between hover:shadow-md hover:bg-slate-100/50 transition-all duration-300 shadow-sm relative group h-full">
        <!-- Card Header: Title -->
        <div class="flex items-center gap-3 w-full mb-6">
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

        <!-- Female Breakdown Details -->
        <div class="w-full space-y-2 pt-4 border-t border-gray-100 mt-auto">
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#EC4899] block"></span>
                    <span>Adolescent Girl</span>
                </div>
                <span class="font-bold text-gray-800">{{data.adolescentGirl}}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] block"></span>
                    <span>Woman</span>
                </div>
                <span class="font-bold text-gray-800">{{data.woman}}</span>
            </div>
            <div *ngIf="data.children !== undefined" class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#14B8A6] block"></span>
                    <span>Children (< 10y)</span>
                </div>
                <span class="font-bold text-gray-800">{{data.children}}</span>
            </div>
        </div>
    </div>
  `
})
export class ZardEpisodeCardFemaleComponent {
  @Input({ required: true }) data!: EpisodeOfCareFemale;

  get conicGradient(): string {
    const total = this.data.total || 0;
    if (total === 0) {
      return 'conic-gradient(#E5E7EB 0% 100%)';
    }
    const pAdolescent = (this.data.adolescentGirl / total) * 100;
    if (this.data.children !== undefined) {
      const pWoman = (this.data.woman / total) * 100;
      const stop1 = pAdolescent;
      const stop2 = pAdolescent + pWoman;
      return `conic-gradient(#EC4899 0% ${stop1}%, #8B5CF6 ${stop1}% ${stop2}%, #14B8A6 ${stop2}% 100%)`;
    }
    return `conic-gradient(#EC4899 0% ${pAdolescent}%, #8B5CF6 ${pAdolescent}% 100%)`;
  }
}

// Variant 3: Men, Adolescent Boy and Children (age < 10)
@Component({
  selector: 'z-episode-card-male-child',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50/50 border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-between hover:shadow-md hover:bg-slate-100/50 transition-all duration-300 shadow-sm relative group h-full">
        <!-- Card Header: Title -->
        <div class="flex items-center gap-3 w-full mb-6">
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

        <!-- Male & Child Breakdown Details -->
        <div class="w-full space-y-2 pt-4 border-t border-gray-100 mt-auto">
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#3B82F6] block"></span>
                    <span>Men</span>
                </div>
                <span class="font-bold text-gray-800">{{data.men}}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#6366F1] block"></span>
                    <span>Adolescent Boy</span>
                </div>
                <span class="font-bold text-gray-800">{{data.adolescentBoy}}</span>
            </div>
            <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#14B8A6] block"></span>
                    <span>Children (< 10y)</span>
                </div>
                <span class="font-bold text-gray-800">{{data.children}}</span>
            </div>
        </div>
    </div>
  `
})
export class ZardEpisodeCardMaleChildComponent {
  @Input({ required: true }) data!: EpisodeOfCareMaleChild;

  get conicGradient(): string {
    const total = this.data.total || 0;
    if (total === 0) {
      return 'conic-gradient(#E5E7EB 0% 100%)';
    }
    const pMen = (this.data.men / total) * 100;
    const pAdolescentBoy = (this.data.adolescentBoy / total) * 100;
    const stop1 = pMen;
    const stop2 = pMen + pAdolescentBoy;
    return `conic-gradient(#3B82F6 0% ${stop1}%, #6366F1 ${stop1}% ${stop2}%, #14B8A6 ${stop2}% 100%)`;
  }
}

@Component({
  selector: 'z-episodes-of-care',
  standalone: true,
  imports: [CommonModule, ZardEpisodeCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6 md:p-8 mb-8 animate-fadeIn">
        <div class="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
            <div class="flex items-center gap-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">Episodes of Care</h3>
                    <p class="text-sm text-gray-500 font-medium">Total Episodes</p>
                </div>
            </div>
            <div class="text-right">
                <div class="text-4xl font-black text-gray-800 tracking-tight">{{totalReports ?? 0}}</div>
                <div class="text-xs font-bold text-gray-500 tracking-wide mt-1">reports logged</div>
            </div>
        </div>

        <div class="mb-5 text-xs text-gray-400 font-bold uppercase tracking-widest pl-1">Age & Gender Distribution</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <z-episode-card *ngFor="let item of episodes; trackBy: trackByLabel" [data]="item"></z-episode-card>
        </div>
    </div>
  `
})
export class ZardEpisodesOfCareComponent {
  @Input() totalReports: number | null = 0;
  @Input() episodes: EpisodeOfCare[] | null = [];

  trackByLabel(index: number, item: any): string {
    return item.label;
  }
}
