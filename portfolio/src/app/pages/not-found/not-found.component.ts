import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <h1 class="not-found__title">404</h1>
      <p class="not-found__subtitle">Page not found</p>
      <p class="not-found__description">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a routerLink="/" class="not-found__link">Back to portfolio</a>
    </section>
  `,
  styles: `
    .not-found {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 2rem;
    }

    .not-found__title {
      font-size: 8rem;
      font-weight: bold;
      color: var(--color-primary);
      line-height: 1;
      margin-bottom: 0.5rem;
    }

    .not-found__subtitle {
      font-size: var(--font-size-2xl);
      color: var(--color-text);
      margin-bottom: 1rem;
    }

    .not-found__description {
      color: var(--color-text-muted);
      margin-bottom: 2rem;
      max-width: 400px;
    }

    .not-found__link {
      color: var(--color-primary);
      border: 1px solid var(--color-border);
      padding: 0.75rem 1.5rem;
      border-radius: var(--border-radius-full);
      transition: all var(--transition-fast);
      font-weight: var(--font-weight-medium);
    }

    .not-found__link:hover {
      background: rgba(2, 211, 200, 0.15);
      border-color: var(--color-border-hover);
    }
  `,
})
export class NotFoundComponent {}
