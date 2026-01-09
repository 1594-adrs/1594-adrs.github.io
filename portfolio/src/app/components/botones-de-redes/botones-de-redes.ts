import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SocialNetwork {
  icon: string;
  url: string;
  label: string;
}

@Component({
  selector: 'app-botones-de-redes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './botones-de-redes.html',
  styleUrls: ['./botones-de-redes.css']
})
export class BotonesDeRedesComponent {
  socialNetworks: SocialNetwork[] = [
    {
      icon: 'fab fa-github',
      url: 'https://github.com/1594-adrs',
      label: 'GitHub'
    },
    {
      icon: 'fab fa-linkedin',
      url: 'https://www.linkedin.com/in/1594-adrs/',
      label: 'LinkedIn'
    },
    {
      icon: 'fa-regular fa-envelope',
      url: 'mailto:andresdrincons2007@gmail.com',
      label: 'Email'
    }
  ];
}

