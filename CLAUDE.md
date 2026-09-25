# CLAUDE.md

Personal portfolio (Angular 21) deployed to GitHub Pages. The app lives entirely in `portfolio/`; **run every `npm` / `ng` command from `portfolio/`**. The repo root only holds CI, docs and Claude Code config.

## Commands (from `portfolio/`)

```bash
npm start                                   # dev server, localhost:4200
npm run build                               # prod build → dist/portfolio/browser (prerendered, no SSR runtime)
npm run typecheck                           # tsc --noEmit
npx ng test --watch=false                   # Vitest via @angular/build:unit-test (globals on; not Karma)
npx ng test --include='src/path/x.spec.ts'  # single spec
npm run format                              # Prettier: single quotes, 100 cols, angular parser for HTML
```

No lint script. Before finishing any code change run `typecheck` + tests. CI (`.github/workflows/deploy.yml`, push to `main`) runs typecheck → test → build → Pages deploy. Budgets: initial bundle 500 kB warn / 1 MB error; component CSS 8 kB warn / 10 kB error (per stylesheet, minified).

## Git

Work on `develop`; `main` receives PRs from `develop` and deploys. Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`), one logical change per commit.

## Architecture

- **Routes** (`src/app/app.routes.ts`): portfolio at `''` loaded eagerly (not a redirect — GitHub Pages); `web-projects`, `web-projects/calculator`, `**` (404) lazy. All prerendered (`app.routes.server.ts`). Section nav uses `scrollIntoView` + `href="#section"`, not router fragments.
- **Content is data-driven**: all portfolio text/data in `src/app/shared/data/portfolio.data.ts`, types in `shared/models/portfolio.models.ts`. Edit data there, not in templates.
- **Shared UI**: `<app-icon name="...">` renders inline SVGs from `shared/icons/icon-data.ts` (no icon library). Global styles: `src/styles.css` imports `shared/styles/*.css` (CSS variables, `cards.css`). All `@keyframes` + the `prefers-reduced-motion` rule live in `shared/animations/animations.css`. `reveal-on-scroll` directive wraps IntersectionObserver.

## Conventions

- Standalone components, `ChangeDetectionStrategy.OnPush` everywhere, signals for state (no BehaviorSubject), `input()`/`output()`/`inject()`, `host: {}` metadata instead of `@HostListener`, `@if`/`@for` control flow, plain CSS (no SCSS).
- Pages are prerendered: guard browser APIs with `isPlatformBrowser` (or `afterNextRender`), use `viewChild()` without `.required`, run canvas/RAF loops in `NgZone.runOutsideAngular()`.
- Naming is mixed (legacy `FooComponent` in `foo.component.ts` vs `Foo` in `foo.ts`). New code follows the Angular 20+ style: `foo.ts` / class `Foo`.
- Use CSS variables from `shared/styles` instead of hardcoded colors / z-index.

## Graphing calculator (`src/app/pages/web-projects/projects/graphing-calculator/`)

Keep the layers separate:
- `engine/` — pure math, no DOM/Angular, never imports `models/`: lexer + recursive-descent `parser.ts` (AST cached, bounded by `MAX_AST_NODES`; scientific notation only with uppercase `E`), `evaluator.ts` (real odd roots of negatives), `quadrature.ts` (adaptive Gauss–Kronrod with `'divergent'`/`'undefined'` status — all integration goes through it; `integrator.ts` delegates), `mode-detector.ts` (curve modes incl. `x = g(y)`), `intersection-finder.ts`, `area-splitter.ts`, conics, `asymptote-detector.ts`. Every file has a co-located spec.
- `engine/solids/` — solids by integration. `solid.types.ts` is the contract (method disk-washer / shell / cross-section, variable x|y, pieces, issues); `validateSolidSpec` for input checks, `computeSolid` for volume + formula terms + exact form.
- `state/solid-tool.state.ts` — signal state for the solids panel (axis orientation is derived from method + variable).
- `canvas/` — 2D rendering (`viewport.ts`, grid/graph/implicit renderers, `solid-region-renderer.ts`); `canvas/utils.ts` has the shared `tryEval` and `findAxisCrossings` — reuse them.
- `canvas/solid-3d/` — Three.js viewer (`solid-mesh-builder.ts`: lathe for revolution, `loft.ts` for cross-sections; sweep = clipping plane, no remesh). Dispose every geometry/material/renderer on teardown.
- `components/` — `solid-panel`, `integral-formula`, `math-renderer`, `conic-assistant`. `graphing-calculator.component.ts` is large — put new logic in `engine/`/`state/`/`canvas/`, not in the component.
- UI text is English.
- Keyboard: `+`/`-` zoom, arrows pan, `R` reset.

## Skills & agents

- Angular work: load `angular-developer` (and `angular-best-practices` for reviews). New UI: `frontend-design`; accessibility/UX review: `web-design-guidelines`.
- Subagents (`scout` / `analyst` / `deep-reviewer`) and the orchestration rules live in the user-level `~/.claude/`. In this repo, file ownership for parallel agents usually splits as: `engine/solids/` + `state/` + `components/solid-panel/` · rest of `engine/` + `canvas/utils.ts` · main component/template/CSS.
- A PostToolUse hook (`.claude/hooks/format.mjs`) runs Prettier on every edited file under `portfolio/src`.
- If `graphify-out/graph.json` exists, prefer `graphify query "<question>"` over broad file reads.
