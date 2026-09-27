import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: { meta: 'home' },
    loadComponent: () =>
      import('./pages/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
  },
  {
    path: 'web-projects',
    data: { meta: 'webProjects' },
    loadComponent: () =>
      import('./pages/web-projects/web-projects.component').then((m) => m.WebProjectsComponent),
  },
  {
    path: 'web-projects/calculator',
    data: { meta: 'calculator' },
    loadComponent: () =>
      import('./pages/web-projects/projects/graphing-calculator/graphing-calculator.component').then(
        (m) => m.GraphingCalculatorComponent,
      ),
  },
  {
    path: '404',
    data: { meta: 'notFound' },
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  {
    path: '**',
    data: { meta: 'notFound' },
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
