import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="landing-card" 
      [class.has-image]="bgImage" 
      [style.backgroundImage]="bgImage ? 'url(' + resolvedBgImage + ')' : ''"
    >
      <!-- Glass Overlay and Inner Content -->
      <div class="card-glow-overlay" *ngIf="showGlow"></div>
      <div class="card-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .landing-card {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1.5px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background-size: cover;
      background-position: center;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
                  box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                  border-color 0.3s;
    }
    
    .landing-card:hover {
      transform: translateY(-6px) scale(1.025);
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
    }
    
    .landing-card.has-image {
      background-color: rgba(255, 255, 255, 0.02);
    }

    /* Soft overlay to give high tech/medical glowing contrast */
    .card-glow-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
      pointer-events: none;
      z-index: 1;
    }

    .card-content {
      position: relative;
      z-index: 2;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class LandingCardComponent {
  @Input() bgImage?: string;
  @Input() showGlow: boolean = true;

  get resolvedBgImage(): string {
    if (!this.bgImage) return '';
    if (this.bgImage.startsWith('http://') || this.bgImage.startsWith('https://')) return this.bgImage;
    if (this.bgImage.startsWith('/')) return this.bgImage;
    return `/${this.bgImage}`;
  }
}
