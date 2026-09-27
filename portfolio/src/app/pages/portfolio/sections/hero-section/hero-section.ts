import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Eye } from '../../../../shared/components/eye/eye';
import { PROFILE } from '../../../../shared/data/portfolio.data';
import { MONOGRAM_ASCII } from '../../../../shared/data/monogram';

@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
  styleUrls: ['./hero-section.css'],
  imports: [Eye],
})
export class HeroSection {
  monogram = MONOGRAM_ASCII;

  name = PROFILE.shortName;
  // Keep the last two words ("Full Stack") from wrapping onto separate lines.
  role = PROFILE.role.replace(/ (?=\S+$)/, ' ');
  tagline = PROFILE.tagline;
  availability = PROFILE.availability;
  resumeUrl = PROFILE.resumeUrl;
}
