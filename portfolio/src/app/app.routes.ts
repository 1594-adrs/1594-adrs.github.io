import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'portfolio', pathMatch: 'full' },
  {
    path: 'portfolio',
    loadComponent: () =>
      import('./pages/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
