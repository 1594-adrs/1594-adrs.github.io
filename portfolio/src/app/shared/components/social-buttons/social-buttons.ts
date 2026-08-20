import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SocialNetwork } from '../../models/portfolio.models';

@Component({
  selector: 'app-social-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-buttons.html',
  styleUrls: ['./social-buttons.css'],
})
export class SocialButtons {
  socialNetworks: SocialNetwork[] = [
    {
      icon: 'fab fa-github',
      url: 'https://github.com/1594-adrs',
      label: 'GitHub',
    },
    {
      icon: 'fab fa-linkedin',
      url: 'https://www.linkedin.com/in/1594-adrs/',
      label: 'LinkedIn',
    },
    {
      icon: 'fa-regular fa-envelope',
      url: 'mailto:andresdrincons2007@gmail.com',
      label: 'Email',
    },
  ];
}
