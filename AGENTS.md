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
npm run typecheck     # standalone TypeScript check
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

No lint scripts are defined. Angular CLI's `ng build` and `ng test` perform TypeScript compilation. For a standalone typecheck, run `npm run typecheck` from `portfolio/`.

## Build & deploy

- CI: `.github/workflows/deploy.yml` — builds on push to `main`, deploys to GitHub Pages
- Build output path: `portfolio/dist/portfolio/browser`
- Prerender enabled, SSR disabled (despite `@angular/ssr` being in devDependencies)
- Base href: `/`
- Initial bundle: ~303 kB (budget: 500 kB warning, 1 MB error)
- Component CSS budget: 4 kB warning, 8 kB error

## Code conventions

- Angular standalone components (no NgModules)
- OnPush change detection on all components
- Signals for state management (no BehaviorSubject patterns)
- `viewChild()` without `.required` for SSR safety
- `isPlatformBrowser` guards in all browser-dependent components
- Styles: component-level CSS files (not SCSS), global styles in `src/styles.css`
- Shared card styles extracted to `src/app/shared/styles/cards.css`
- Inline SVG icons via `<app-icon>` component (no external icon library)

## Skills (mandatory for new features)

When implementing new pages or features, load these skills at the start of the session to follow project conventions:
- `angular-developer` — Angular components, signals, lifecycle, rendering
- `angular-best-practices` — OnPush, signals, `isPlatformBrowser`, `viewChild()` without `.required`, `NgZone.runOutsideAngular()` for canvas
- `web-design-guidelines` — ARIA landmarks, keyboard access, focus-visible, skip links, `prefers-reduced-motion`
- `frontend-design` — Consistent pixel-glitch aesthetic, CSS variables, terminal-card style
- `playwright-cli` — Browser testing, e2e verification of UI changes
- `graphify` — Codebase knowledge graph for understanding file relationships and architecture

### Canvas/rendering skills (mandatory for Canvas-heavy projects)

Load these when the feature involves Canvas 2D, WebGL, animation loops, or real-time rendering:
- `canvas-design` — Canvas 2D patterns, drawing, animation loops
- `render-performance` — GPU-accelerated rendering, canvas ops, 60fps UI, memory management

## Component naming

Inconsistent — mixed English naming with and without `Component` suffix:

**Without suffix:** `Navbar`, `SocialButtons`, `ProgressBar`, `Eye`, `LoadingScreen`, `HeroSection`, `AboutMe`, `ProjectsSection`

**With suffix:** `NotFoundComponent`, `WebProjectsComponent`, `GraphingCalculatorComponent`, `PortfolioComponent`

## Key shared files

- `src/app/shared/data/portfolio.data.ts` — All portfolio data (NAV_LINKS, SOCIAL_NETWORKS, SKILLS, COURSES, EDUCATION, SOFT_SKILLS, PROJECTS, WEB_PROJECTS)
- `src/app/shared/models/portfolio.models.ts` — All interfaces (NavLink, SocialNetwork, SkillCategory, Course, Education, Project, WebProject)
- `src/app/shared/icons/icon-data.ts` — SVG icon definitions for inline rendering
- `src/app/shared/icons/icon.component.ts` — `<app-icon name="...">` component replacing Font Awesome
- `src/app/shared/directives/reveal-on-scroll.directive.ts` — Shared IntersectionObserver directive for scroll-reveal animations
- `src/app/shared/styles/cards.css` — Shared terminal card and project card styles
- `src/app/shared/animations/animations.css` — All keyframes and `prefers-reduced-motion` media query

## Routing

- Portfolio page at `''` (root) — loads `PortfolioComponent` directly (not via redirect, for GitHub Pages compatibility)
- Web Projects at `web-projects` — lazy-loaded `WebProjectsComponent`
- Calculator at `web-projects/calculator` — lazy-loaded `GraphingCalculatorComponent`
- 404 at `**` — lazy-loaded `NotFoundComponent`
- Server routes: all prerendered (`RenderMode.Prerender`)
- Navbar uses native `scrollIntoView` + `href="#section"` for section navigation (not Angular router fragments)

## Graphing Calculator

Located at `src/app/pages/web-projects/projects/graphing-calculator/`:

- `engine/parser.ts` — Lexer + recursive descent parser with AST caching
- `engine/evaluator.ts` — AST evaluator (uses cached parser)
- `engine/integrator.ts` — Simpson's rule numerical integration
- `engine/calculus.ts` — Derivatives, multi-function solid volume/surface area (washer/shell methods)
- `engine/intersection-finder.ts` — Multi-function intersection detection
- `engine/area-splitter.ts` — Region computation for multi-function areas
- `canvas/viewport.ts` — World-to-screen coordinate transforms, zoom/pan
- `canvas/grid-renderer.ts` — Axis grid with nice step calculation
- `canvas/graph-renderer.ts` — Function curves, integral areas, crosshair
- `canvas/solid-renderer.ts` — Solid of revolution cross-section visualization
- `canvas/solid-3d/solid-3d.component.ts` — WebGL 3D solid viewer component
- `canvas/solid-3d/solid-scene.ts` — Three.js scene management and disposal
- `canvas/solid-3d/solid-geometry.ts` — Revolution mesh generation
- `canvas/utils.ts` — Shared `tryEval` safe evaluation utility
- `utils/color.ts` — Function color palette
- `models/calculator.models.ts` — TypeScript interfaces

Keyboard access: `+`/`-` zoom, arrow keys pan, `R` reset.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
