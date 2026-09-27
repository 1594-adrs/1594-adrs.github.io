import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { PAGE_META, SITE } from '../data/portfolio.data';
import { PageKey } from '../models/portfolio.models';

/**
 * Reads `data['meta']` (a `PageKey`) from the deepest activated route and applies
 * title, description, canonical link and Open Graph / Twitter tags from `PAGE_META`.
 * Runs during prerender too (Meta/Title/DOCUMENT are server-safe, no `window` access).
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageKey = this.resolvePageKey(snapshot.root);
    const pageMeta = PAGE_META[pageKey ?? 'notFound'];
    const absoluteUrl = `${SITE.url}${pageMeta.path}`;
    const absoluteImage = `${SITE.url}${SITE.ogImage}`;

    this.title.setTitle(pageMeta.title);

    this.meta.updateTag({ name: 'description', content: pageMeta.description });
    this.meta.updateTag({ property: 'og:title', content: pageMeta.title });
    this.meta.updateTag({ property: 'og:description', content: pageMeta.description });
    this.meta.updateTag({ property: 'og:url', content: absoluteUrl });
    this.meta.updateTag({ property: 'og:image', content: absoluteImage });
    this.meta.updateTag({ name: 'twitter:title', content: pageMeta.title });
    this.meta.updateTag({ name: 'twitter:description', content: pageMeta.description });
    this.meta.updateTag({ name: 'twitter:image', content: absoluteImage });
    this.meta.updateTag({
      name: 'robots',
      content: pageMeta.noindex ? 'noindex, nofollow' : 'index, follow',
    });

    this.setCanonical(absoluteUrl);
    this.setStructuredData(pageKey, absoluteUrl);
  }

  private resolvePageKey(root: ActivatedRouteSnapshot): PageKey | undefined {
    let deepest: ActivatedRouteSnapshot = root;
    while (deepest.firstChild) {
      deepest = deepest.firstChild;
    }
    let route: ActivatedRouteSnapshot | null = deepest;
    while (route) {
      const meta = route.data['meta'] as PageKey | undefined;
      if (meta) {
        return meta;
      }
      route = route.parent;
    }
    return undefined;
  }

  private setCanonical(href: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** Adds a page-specific JSON-LD node (only the calculator has one so far). */
  private setStructuredData(pageKey: PageKey | undefined, absoluteUrl: string): void {
    const existing = this.document.getElementById('ld-json-page');
    existing?.remove();

    if (pageKey !== 'calculator') {
      return;
    }

    const script = this.document.createElement('script');
    script.id = 'ld-json-page';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Graphing Calculator',
      url: absoluteUrl,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    });
    this.document.head.appendChild(script);
  }
}
