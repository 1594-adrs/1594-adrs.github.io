import { Component, ChangeDetectionStrategy, OnDestroy, signal } from '@angular/core';
import { Profile } from '../../../../shared/models/portfolio.models';
import { EMAIL_COMPOSE_URL, PROFILE } from '../../../../shared/data/portfolio.data';
import { RevealOnScroll } from '../../../../shared/directives/reveal-on-scroll.directive';
import { IconComponent } from '../../../../shared/icons/icon.component';

@Component({
  selector: 'app-contact-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-section.html',
  styleUrls: ['./contact-section.css'],
  imports: [RevealOnScroll, IconComponent],
})
export class ContactSection implements OnDestroy {
  profile: Profile = PROFILE;
  composeUrl = EMAIL_COMPOSE_URL;
  copied = signal(false);
  private resetTimer?: ReturnType<typeof setTimeout>;

  async copyEmail() {
    try {
      await navigator.clipboard.writeText(this.profile.email);
    } catch {
      // Clipboard API unavailable (insecure context / old browser): select the
      // visible address so the visitor can copy it manually.
      const el = document.querySelector('.contact-email');
      if (el) window.getSelection()?.selectAllChildren(el);
      return;
    }
    this.copied.set(true);
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  }

  ngOnDestroy() {
    clearTimeout(this.resetTimer);
  }
}
