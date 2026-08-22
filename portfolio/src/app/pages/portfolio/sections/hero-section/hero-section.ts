import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Eye } from '../../../../shared/components/eye/eye';

@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css'],
  imports: [Eye],
})
export class HeroSection {
  imageFailed = signal(false);

  onImageError() {
    this.imageFailed.set(true);
  }
}
