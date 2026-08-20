import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { ProgressBar } from './shared/components/progress-bar/progress-bar';
import { SocialButtons } from './shared/components/social-buttons/social-buttons';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, ProgressBar, SocialButtons],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent {
  currentYear = new Date().getFullYear();
}
