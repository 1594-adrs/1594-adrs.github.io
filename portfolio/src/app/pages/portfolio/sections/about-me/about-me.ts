import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SkillCategory, Course } from '../../../../shared/models/portfolio.models';
import {
  PROFILE,
  SKILLS,
  COURSES,
  EDUCATION,
  SOFT_SKILLS,
} from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';

@Component({
  selector: 'app-about-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-me.html',
  styleUrls: ['./about-me.css'],
  imports: [RevealOnScroll],
})
export class AboutMe {
  name = PROFILE.name;
  title = PROFILE.title;
  level = PROFILE.level;

  description = PROFILE.description;

  skills: SkillCategory[] = SKILLS;
  courses: Course[] = COURSES;
  education = EDUCATION;
  softSkills = SOFT_SKILLS;
}
