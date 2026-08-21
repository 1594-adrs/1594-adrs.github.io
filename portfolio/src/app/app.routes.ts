import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
  },
  {
    path: 'web-projects',
    loadComponent: () =>
      import('./pages/web-projects/web-projects.component').then(
        (m) => m.WebProjectsComponent,
      ),
  },
  {
    path: 'web-projects/calculator',
    loadComponent: () =>
      import(
        './pages/web-projects/projects/graphing-calculator/graphing-calculator.component'
      ).then((m) => m.GraphingCalculatorComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
