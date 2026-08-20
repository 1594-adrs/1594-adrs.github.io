# AGENTS.md

## Project structure

Monorepo with root `package.json` that has no dependencies. The actual Angular application lives entirely in `portfolio/`.

**All `npm` / `ng` commands must run from `portfolio/`**, not the repo root.

```
.github/workflows/deploy.yml   ← GitHub Pages deploy (builds from portfolio/)
portfolio/                      ← Angular 21 app (the only thing to build/test)
```

## Development commands

All commands from `portfolio/`:

```bash
cd portfolio
npm install           # install deps (packageManager: npm@11.6.2)
npm start             # dev server at localhost:4200
npm run build         # production build → portfolio/dist/portfolio/browser
npm test              # unit tests via Vitest
npm run format        # Prettier (src/**/*.{ts,html,css,scss})
```

## Testing

- Test runner: **Vitest** (not Karma)
- Test builder: `@angular/build:unit-test` (configured in `angular.json`)
- Test globals: `vitest/globals` (no need to import `describe`/`it`/`expect`)
- Run a single test file: `npx ng test --include='src/path/to/file.spec.ts'`
- Test spec pattern: `*.spec.ts` co-located with components

## Formatting

- Prettier with `prettier-plugin-angular`
- Config in `portfolio/.prettierrc` (source of truth)
- Angular HTML uses `"parser": "angular"` override
- Single quotes, 100 char width, 2-space indent

No lint or typecheck scripts are defined. Angular CLI's `ng build` and `ng test` perform TypeScript compilation. If you need a standalone typecheck step, run `npm run typecheck` from `portfolio/`.

## Build & deploy

- CI: `.github/workflows/deploy.yml` — builds on push to `main`, deploys to GitHub Pages
- Build output path: `portfolio/dist/portfolio/browser`
- Prerender enabled, SSR disabled (despite `@angular/ssr` being in devDependencies)
- Base href: `/`

## Code conventions

- Angular standalone components (no NgModules)
- Component files use Spanish names: `barra-de-navegacion`, `botones-de-redes`, `barra-de-progreso`
- Component class names omit `Component` suffix in some cases (`HeroSection`, `ProjectsSection`, `BarraDeProgreso`) while others include it (`BarraDeNavegacionComponent`, `BotonesDeRedesComponent`)
- Styles: component-level CSS files (not SCSS), global styles in `src/styles.css`
- `styleUrl` (singular) used in `@Component` decorators
- External: Font Awesome loaded via CDN in `index.html`
