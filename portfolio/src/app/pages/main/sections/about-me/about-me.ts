import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  skills,
  courses,
  education,
  softSkills,
  bioData,
  SkillCategory,
  Course,
} from '../../../../shared/data/portfolio.data';
import { RevealOnScrollDirective } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-about-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScrollDirective],
  templateUrl: './about-me.html',
  styleUrls: ['./about-me.css'],
})
export class AboutMe {
  sectionRevealed = signal(false);

  name = bioData.name;
  title = bioData.title;
  level = bioData.level;
  description = bioData.description;

  skills: SkillCategory[] = skills;
  courses: Course[] = courses;
  education = education;
  softSkills = softSkills;

  onReveal() {
    this.sectionRevealed.set(true);
  }
}
