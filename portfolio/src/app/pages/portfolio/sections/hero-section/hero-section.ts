import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Eye } from '../../../../shared/components/eye/eye';

@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css'],
  imports: [Eye],
})
export class HeroSection {
  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
