import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SkillCategory, Course } from '../../../../shared/models/portfolio.models';
import { SKILLS, COURSES, EDUCATION, SOFT_SKILLS } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-about-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-me.html',
  styleUrls: ['./about-me.css'],
  imports: [RevealOnScroll],
})
export class AboutMe {
  name = 'Andrés David Rincón Salazar';
  title = 'Software Developer';
  level = 'Mid-Level';

  description = `I build software that works. Computer Science student at UTP, I write clean code in Python, Java, and TypeScript, and I pick up new stacks quickly. Certified in AI and prompt engineering. Currently sharpening my skills through competitive programming.`;

  skills: SkillCategory[] = SKILLS;
  courses: Course[] = COURSES;
  education = EDUCATION;
  softSkills = SOFT_SKILLS;
}
