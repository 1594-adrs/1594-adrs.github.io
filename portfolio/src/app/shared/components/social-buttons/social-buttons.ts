import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SocialNetwork } from '../../models/portfolio.models';
import { SOCIAL_NETWORKS } from '../../data/portfolio.data';

@Component({
  selector: 'app-social-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-buttons.html',
  styleUrls: ['./social-buttons.css'],
})
export class SocialButtons {
  socialNetworks: SocialNetwork[] = SOCIAL_NETWORKS;
}
