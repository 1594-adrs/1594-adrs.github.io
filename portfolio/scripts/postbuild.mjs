#!/usr/bin/env node
/**
 * GitHub Pages serves /404.html for any unmatched path. The '404' route is prerendered
 * to dist/portfolio/browser/404/index.html by the Angular build; copy it to the root
 * 404.html that GitHub Pages actually looks for.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BROWSER_DIR = join(__dirname, '..', 'dist', 'portfolio', 'browser');
const SOURCE = join(BROWSER_DIR, '404', 'index.html');
const DEST = join(BROWSER_DIR, '404.html');

if (!existsSync(SOURCE)) {
  console.error(`postbuild: expected prerendered ${SOURCE} — did the '404' route render?`);
  process.exit(1);
}

copyFileSync(SOURCE, DEST);
console.log(`postbuild: copied 404/index.html to 404.html`);
