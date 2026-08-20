import { Component, ChangeDetectionStrategy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Eye } from '../../../../shared/components/eye/eye';

@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css'],
  imports: [Eye],
})
export class HeroSection {
  constructor() {
    isPlatformBrowser(inject(PLATFORM_ID));
  }
}
