import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <h1 class="not-found__title">404</h1>
      <p class="not-found__subtitle">&gt; ERROR: PAGE_NOT_FOUND</p>
      <p class="not-found__description">
        The memory address requested does not exist in this segment.
      </p>
      <a routerLink="/" class="not-found__link">&gt; cd /portfolio</a>
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
      background: var(--color-bg-dark);
    }

    .not-found__title {
      font-size: 8rem;
      font-weight: bold;
      color: var(--color-corruption);
      line-height: 1;
      margin-bottom: 0.5rem;
      font-family: var(--font-family-display);
      letter-spacing: 6px;
    }

    .not-found__subtitle {
      font-size: var(--font-size-2xl);
      color: var(--color-text);
      margin-bottom: 1rem;
      font-family: var(--font-family-display);
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .not-found__description {
      color: var(--color-text-muted);
      margin-bottom: 2rem;
      max-width: 400px;
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
    }

    .not-found__link {
      color: var(--color-primary);
      border: 1px solid var(--color-primary);
      padding: 0.75rem 1.5rem;
      transition:
        background var(--transition-fast),
        color var(--transition-fast);
      font-weight: var(--font-weight-medium);
      font-family: var(--font-family-display);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .not-found__link:hover {
      background: var(--color-primary);
      color: var(--color-bg-dark);
    }
  `,
})
export class NotFoundComponent {}
