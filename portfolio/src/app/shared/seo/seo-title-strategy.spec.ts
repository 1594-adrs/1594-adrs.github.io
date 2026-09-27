import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { SeoTitleStrategy } from './seo-title-strategy';
import { PAGE_META, SITE } from '../data/portfolio.data';

function snapshotWithMeta(meta: string | undefined): RouterStateSnapshot {
  const root = {
    data: {},
    parent: null,
    firstChild: null,
  } as unknown as ActivatedRouteSnapshot;

  const child = {
    data: meta ? { meta } : {},
    parent: root,
    firstChild: null,
  } as unknown as ActivatedRouteSnapshot;

  (root as unknown as { firstChild: ActivatedRouteSnapshot | null }).firstChild = child;

  return { root } as RouterStateSnapshot;
}

describe('SeoTitleStrategy', () => {
  let strategy: SeoTitleStrategy;
  let title: Title;
  let meta: Meta;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeoTitleStrategy],
    });
    strategy = TestBed.inject(SeoTitleStrategy);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    document = TestBed.inject(DOCUMENT);
  });

  it('applies title, description, canonical and OG tags for a known page key', () => {
    strategy.updateTitle(snapshotWithMeta('webProjects'));

    const expected = PAGE_META['webProjects'];
    expect(title.getTitle()).toBe(expected.title);
    expect(meta.getTag('name="description"')?.content).toBe(expected.description);
    expect(meta.getTag('property="og:title"')?.content).toBe(expected.title);
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE.url}${expected.path}`);
    expect(meta.getTag('property="og:image"')?.content).toBe(`${SITE.url}${SITE.ogImage}`);
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(`${SITE.url}${expected.path}`);
  });

  it('falls back to the notFound page meta (noindex) when no route sets data.meta', () => {
    strategy.updateTitle(snapshotWithMeta(undefined));

    const expected = PAGE_META['notFound'];
    expect(title.getTitle()).toBe(expected.title);
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('injects a valid SoftwareApplication JSON-LD block only for the calculator page', () => {
    strategy.updateTitle(snapshotWithMeta('calculator'));
    const script = document.getElementById('ld-json-page');
    expect(script).toBeTruthy();
    const parsed = JSON.parse(script!.textContent ?? '{}');
    expect(parsed['@type']).toBe('SoftwareApplication');

    strategy.updateTitle(snapshotWithMeta('home'));
    expect(document.getElementById('ld-json-page')).toBeNull();
  });

  it('reuses the same canonical link element across updates instead of duplicating it', () => {
    strategy.updateTitle(snapshotWithMeta('home'));
    strategy.updateTitle(snapshotWithMeta('calculator'));

    const canonicals = document.querySelectorAll('link[rel="canonical"]');
    expect(canonicals.length).toBe(1);
    expect(canonicals[0].getAttribute('href')).toBe(`${SITE.url}${PAGE_META['calculator'].path}`);
  });
});
