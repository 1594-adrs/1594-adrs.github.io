import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Profile } from '../../../../shared/models/portfolio.models';
import { PROFILE } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';
import { IconComponent } from '../../../../shared/icons/icon.component';

@Component({
  selector: 'app-contact-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-section.html',
  styleUrls: ['./contact-section.css'],
  imports: [RevealOnScroll, IconComponent],
})
export class ContactSection {
  profile: Profile = PROFILE;
}
