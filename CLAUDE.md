# QuantFlow Simulator

High-fidelity market simulator with multiple stochastic engines and real-time technical analysis visualization.

## Tech Stack
- TypeScript, React 19, Vite 6
- Canvas-based financial charting (custom)
- Stochastic engines: GBM, Momentum, Ornstein-Uhlenbeck, GARCH

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run typecheck` — TypeScript type checking

## CI/CD
- **CI**: GitHub Actions runs type check + build on PRs/pushes to `develop` and `main`
- **Deploy**: GitHub Pages auto-deploy on push to `main`
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

## Project Structure
- `App.tsx` — main application component, simulation orchestration
- `components/` — UI components (chart, modals, menus, simulator views)
- `services/` — market engines and technical indicators
- `types.ts` — shared TypeScript types and market presets

## Key Files
- `services/marketEngine.ts` — Geometric Brownian Motion engine
- `services/momentumEngine.ts` — Momentum-based price engine
- `services/ouEngine.ts` — Ornstein-Uhlenbeck mean-reversion engine
- `services/garchEngine.ts` — GARCH volatility clustering engine
- `services/indicators.ts` — Streaming EMA, HMA, MACD, ATR indicators
- `components/FinancialChart.tsx` — Canvas-rendered candlestick chart
- `components/SimulatorView.tsx` — Primary simulator UI
- `components/SimulatorViewV2.tsx` — V2 simulator layout

## Conventions
- Flat project structure (no `src/` directory)
- Path alias: `@/*` maps to project root
- Streaming/incremental indicator calculations (not batch)
- Market presets defined in `types.ts` (GENERIC, EURUSD)
- Branch naming: `<type>/<task-id>-<short-slug>`
- Commit style: Conventional Commits

## Git Workflow
- **Gitflow**: `main` (production) + `develop` (integration)
- Feature branches: `feature/<task-id>-<slug>`
- Release branches: `release/<version>`
- Hotfix branches: `hotfix/<description>`

## Notion Board
- **Workspace**: https://www.notion.so/3336c88ed4248131b04af942467bc447
- **Tasks DB**: https://www.notion.so/4258c861091242e09c3c61be5c1877ba (data_source: `37827228-8a58-433e-ab12-95797eb77df4`)
- **Changelog DB**: https://www.notion.so/c3b57c4a92894165ba48c4de8ba62b45 (data_source: `f354b231-30f0-4773-837b-66d3dec9b7c1`)
- **Bugs DB**: https://www.notion.so/40d110c3f2b6440eb575a471f9b44053 (data_source: `23d21c38-cf3f-418d-8516-cf8cd8f01d82`)

## MCP Servers
- Notion (user-level)
