import { Component, ChangeDetectionStrategy } from '@angular/core';
import { socialNetworks } from '../../data/portfolio.data';
import { SocialNetwork } from '../../models/portfolio.models';

@Component({
  selector: 'app-social-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-buttons.html',
  styleUrls: ['./social-buttons.css'],
})
export class SocialButtons {
  networks: SocialNetwork[] = socialNetworks;
}
