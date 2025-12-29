import { Component, signal, HostListener, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'barra-de-progreso',
  standalone: true,
  template: `
    <div class="scroll-progress-container">
      <div class="scroll-progress-bar" [style.height.%]="scrollProgress()"></div>
    </div>
  `,
  styles: [`
    .scroll-progress-container {
      position: fixed;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      width: 8px;
      height: 200px;
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      z-index: 9999;
      overflow: hidden;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }

    .scroll-progress-bar {
      width: 100%;
      background: linear-gradient(180deg, #02d3c8, #23d5ab);
      border-radius: 10px;
      transition: height 0.1s ease-out;
      box-shadow: 0 0 8px rgba(35, 213, 171, 0.6);
    }
  `]
})
export class BarraDeProgreso {
  scrollProgress = signal(0);
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.isBrowser) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (scrollHeight > 0) {
      const progress = (scrollTop / scrollHeight) * 100;
      this.scrollProgress.set(Math.min(100, Math.max(0, progress)));
    }
  }
}
