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
      position: relative;
      z-index: var(--z-content);
      min-height: 100vh;
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 2rem;
      background: var(--color-bg-dark);
    }

    .not-found__title {
      font-size: clamp(3.5rem, 2.4rem + 5.5vw, 8rem);
      font-weight: var(--font-weight-normal);
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
      font-weight: var(--font-weight-normal);
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
      font-weight: var(--font-weight-normal);
    }
  `,
})
export class NotFoundComponent {}
