import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ExperienceItem } from '../../../../shared/models/portfolio.models';
import { EXPERIENCE } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience.html',
  styleUrls: ['./experience.css'],
  imports: [RevealOnScroll],
})
export class Experience {
  items: ExperienceItem[] = EXPERIENCE;
}
