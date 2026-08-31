import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SocialNetwork } from '../../models/portfolio.models';
import { SOCIAL_NETWORKS } from '../../data/portfolio.data';
import { IconComponent } from '../../icons/icon.component';

@Component({
  selector: 'app-social-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-buttons.html',
  styleUrls: ['./social-buttons.css'],
  imports: [IconComponent],
})
export class SocialButtons {
  socialNetworks: SocialNetwork[] = SOCIAL_NETWORKS;
}
