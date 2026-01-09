import { Component, signal, PLATFORM_ID, Inject, AfterViewInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { EyeComponent } from '../../components/eye/eye';

@Component({
  selector: 'hero-section',
  standalone: true,
  imports: [CommonModule, EyeComponent],
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css']
})
export class HeroSection implements AfterViewInit {
  private isBrowser: boolean;
  
  // Texto para animación escalonada
  greetingChars = 'Hello, I am'.split('');
  nameChars = 'Andrés Rincón'.split('');
  roleChars = 'Full Stack Developer'.split('');

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    // Hero section initialized
  }
}
