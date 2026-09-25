import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Eye } from '../../../../shared/components/eye/eye';
import { PROFILE } from '../../../../shared/data/portfolio.data';

@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css'],
  imports: [Eye],
})
export class HeroSection {
  imageFailed = signal(false);

  name = PROFILE.shortName;
  role = PROFILE.role;

  onImageError() {
    this.imageFailed.set(true);
  }
}
