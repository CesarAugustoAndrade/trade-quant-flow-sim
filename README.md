# QuantFlow Simulator

A high-fidelity market simulator and trading practice tool. QuantFlow generates synthetic price action using several stochastic engines — Geometric Brownian Motion (GBM), a momentum engine, an Ornstein-Uhlenbeck mean-reversion engine, and a GARCH volatility-clustering engine — and renders it as live candlestick charts with streaming technical indicators (EMA, MACD, ATR, RSI). You can place long/short trades with stop-loss and take-profit levels, capture an indicator snapshot at entry, and review session statistics. An optional Express + SQLite backend persists trades for later analysis.

## Features

- Multiple price-generation engines:
  - `MarketEngine` — Geometric Brownian Motion (Box-Muller normal shocks)
  - `MomentumEngine` — momentum-driven price movement
  - `OUEngine` — Ornstein-Uhlenbeck mean reversion
  - `GARCHEngine` — GARCH volatility clustering
- Streaming/incremental technical indicators: EMA, MACD, ATR, and an "Ultimate RSI" (computed bar-by-bar rather than in batches)
- Canvas-rendered candlestick financial chart with MACD and RSI dashboards
- Trade management: open LONG/SHORT positions with stop-loss / take-profit, manual or TP/SL exits, PnL tracking, and per-trade indicator snapshots
- Session statistics: win rate, average risk/reward, profit factor, largest win/loss, consecutive win/loss streaks, total pips, average duration
- Market presets (e.g. GENERIC, EURUSD) and selectable simulation/day profiles (trend up/down, reversals, choppy)
- Optional backend API (Express + better-sqlite3) for persisting trades, with the frontend degrading gracefully when the server is offline

## Tech Stack

- React 19 + TypeScript
- Vite 6 (dev server proxies `/api` to the backend)
- Custom Canvas-based charting (no charting library)
- Backend: Express 4, `better-sqlite3`, `cors`
- `tsx` for running the TypeScript server
- CI/CD via GitHub Actions (type check + build, and GitHub Pages deploy)

## Getting Started

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the frontend dev server (runs on port 3000):
   ```bash
   npm run dev
   ```
3. (Optional) In a separate terminal, start the backend API (runs on port 3001) to enable trade persistence:
   ```bash
   npm run dev:server
   ```

Other scripts:

- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run typecheck` — TypeScript type checking (`tsc --noEmit`)

## Project Structure

```
App.tsx                      # Root component, simulation orchestration & indicator dashboards
index.tsx / index.html       # Entry point
types.ts                     # Shared types, market presets, trade/session types
services/
  marketEngine.ts            # GBM price engine
  momentumEngine.ts          # Momentum price engine
  ouEngine.ts                # Ornstein-Uhlenbeck mean-reversion engine
  garchEngine.ts             # GARCH volatility engine
  indicators.ts              # Streaming EMA / MACD / ATR / RSI
  tradeApi.ts                # Frontend client for the backend trade API
components/
  FinancialChart.tsx         # Canvas candlestick chart
  SimulatorView.tsx          # Primary simulator UI
  SimulatorViewV2.tsx        # Alternate simulator layout
  SimulationMenu.tsx         # Simulation setup menu
  TradeDetailsModal.tsx      # Per-trade detail view
  ToastNotification.tsx      # Toasts
  ErrorBoundary.tsx          # Error boundary
server/
  index.ts                   # Express app (port 3001)
  db.ts                      # SQLite (better-sqlite3) setup
  routes/health.ts           # GET /api/health
  routes/trades.ts           # CRUD: POST/GET/GET:id/DELETE:id /api/trades
.github/workflows/           # CI (ci.yml) and GitHub Pages deploy (deploy.yml)
vite.config.ts               # Vite config + /api proxy to localhost:3001
```
