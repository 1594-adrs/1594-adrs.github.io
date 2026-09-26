# 1594-adrs.github.io

Personal portfolio of Andrés Rincón — live at <https://1594-adrs.github.io>.

Built with Angular 21 (standalone components, signals, prerendered static pages). Includes an interactive graphing calculator (expression parser, numeric integration, conics, asymptotes, 2D canvas and Three.js solids of revolution).

## Development

The app lives in `portfolio/`:

```bash
cd portfolio
npm install
npm start          # http://localhost:4200
npm test           # Vitest
npm run build      # output: portfolio/dist/portfolio/browser
```

Pushing to `main` runs typecheck, tests and build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).
