# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI Model Instructions

**When spawning Plan or research agents, always use `model: "opus"` (claude-opus-5-5). Use `model: "sonnet"` (claude-sonnet-5-5) for implementation.**

# QuantFlow Simulator

Trading-practice simulator: stochastic engines generate synthetic 1-minute candles, streamed into a custom Canvas chart with live indicators; the user trades LONG/SHORT with SL/TP and every entry stores an indicator snapshot. An optional Express + SQLite backend journals trades.

## Commands
- `npm run dev` — Vite dev server on port 3000 (proxies `/api` → `localhost:3001`)
- `npm run dev:server` — backend API on port 3001 (`tsx watch server/index.ts`); optional
- `npm run typecheck` — `tsc --noEmit`; `tsconfig.json` has no `include`, so this checks frontend **and** `server/`
- `npm run build` / `npm run preview` — production build to `dist/`

There is no test runner and no linter. CI (`.github/workflows/ci.yml`) runs `npm ci && npm run typecheck && npm run build` on Node 20 for pushes/PRs to `main` and `develop`; `deploy.yml` publishes `dist/` to GitHub Pages on push to `main`.

## Architecture

### `App.tsx` owns everything stateful
`App.tsx` (~1.4k lines) holds all simulation state, engines, indicators, trades and hotkeys. `SimulationMenu` and the three views are presentational. `App` builds one `viewProps: SimulatorViewProps` object (type exported from `SimulatorView.tsx`) and spreads it into V1 (`SimulatorView`), V2 (`SimulatorViewV2`) and V3 (`SimulatorViewV3`, which adds a few DAX-only props). The views only call back into `App`. `onSelect(simType, preset, view)` picks the view: the menu's hero card opens V3 (DAX), and the legacy cards open V2 (EUR/USD) or V1. TradingView-style building blocks shared by V2 and V3 live in `components/tv/`: the palette, icons, `TBtn`/`Section`/`Param`, `MacdDashboardPanel` and `TradesPanel`.

### V3 — GER40 / DAX
- `services/daxEngine.ts` (`DaxEngine`, `SimulationType.DAX`, `MarketPreset.DAX`) models a GER40 CFD:
  - Mon–Fri 01:00–22:00 Berlin time. No candles exist outside the session, so candle times jump over nights and weekends.
  - Intraday volatility seasonality (Xetra open, lunch, 14:30 US data, 15:30 US open, Xetra close), GARCH clustering, Student-t shocks and microstructure noise.
  - Daily trend/reversal/range regimes, multi-day drift and session-open gaps.
  - Candles carry `volume`. Berlin time and DST are computed without `Intl`, which is too slow for history generation. `DaxParams` (daily vol %, trendiness, news impact) are the user knobs.
- `prefillDaxHistory` (called from `resetSimulation`) generates ~30 days up to the latest weekday's 08:00 Berlin. It pushes them into a chart feed capped by `V3_MAX_BARS` (1m: 1000, 5m: 200; 4h trimmed to 100 at start and then grows). It runs `replayIndicators(history)` so the 1m arrays and the dashboard start warmed up. Reset generates a fresh month.
- `components/ProChart.tsx` is V3's chart: native LWC panes (price + volume + EMAs, timeframe MACD), a second chart for the always-on 4h MACD, crosshair OHLC legend, Berlin-time axis, watermark and bar-close countdown. It uses `autoSize` and no `React.memo` comparator.

### Simulation loop and the ref-mirror pattern
- A single `setInterval` (period `config.tickSpeedMs`) produces one candle per tick (`CANDLE_TIME_STEP = 60` s) from the engine selected by `SimulationType`. Engines in `services/*Engine.ts` are stateful classes with `nextTick(...)` returning a `CandleData`; they hold current price/time (GARCH also holds sigma).
- The interval callback and the `keydown` handler are long-lived closures, so they read state through `*Ref` mirrors kept in sync by `useEffect(() => { xRef.current = x }, [x])`. Any new state read inside the loop or hotkeys needs a ref mirror, or it will be stale.
- The 1m state arrays (candles, MACD, EMAs, RSI) are capped at `MAX_POINTS` (2000).

### Indicators are streaming
`services/indicators.ts` classes (`StreamingEMA`, `StreamingMACD`, `StreamingATR`, `StreamingUltimateRSI`, `StreamingHMA`/`WMA`) take one value per call via `next(...)`. Adding or changing an indicator usually means touching four places in `App.tsx`: the engine ref, `resetSimulation` (re-instantiation), `replayIndicators` (replays candles through fresh engines; run by the recalculation effect when a period/setting changes, and over the V3 history prefill), and the tick loop. If the indicator is drawn on the chart, it also has to go into `TimeframeAggregator`, or it won't appear on 5m/4h.

Naming gotcha: `hmaEngineRef`/`hma2EngineRef`/`hmaData`/`hma2Data` are actually `StreamingEMA` instances (they are EMA2/EMA3, and snapshots store them as `ema2`/`ema3`). `StreamingHMA` exists but is currently unused.

### Multi-timeframe dashboard
The tick loop aggregates 1-min candles into 3m, 5m, 15m, 60m (1H EMA 35/115) and 240-candle "daily" buffers, each feeding its own indicator instance. The pure function `computeMacdDashboard` (top of `App.tsx`) combines them into `MacdDashboardData`: daily bias, 1H trend, 15m MACD state, price/RSI pivot divergence and a weighted "drift" score.

### Chart timeframes (1m / 5m / 4h)
Engines always emit 1m candles, and trading, SL/TP, ATR and the MTF dashboard always run on 1m. Only the chart follows the selected `Timeframe` (`types.ts`). `services/timeframeAggregator.ts` builds each timeframe from the 1m stream, with its own `maxBars` history. Storage is trimmed in chunks, and `getChartData()` returns at most `maxBars`. Buckets are aligned to epoch time. The forming bar's indicators come from the indicator classes' `peek()`, which doesn't advance state, and the engines only call `next()` when the bar closes.

`chartFeedRef` (built by `createChartFeed`) holds the aggregators. For V1/V2 it covers only 5m/4h, with 2000 bars each, and their 1m chart comes from the App state arrays. For V3 it covers all three timeframes. `publishChartFeed` sets `htfChartData` (plus `macd4hData`) whenever the feed has the selected timeframe. `chartData = htfChartData ?? <1m state>`. `handleTimeframeChange` sets the timeframe and its data in the same render, so the chart never gets one without the other.

### Auto mode (GBM only)
With auto mode on, GBM volatility/drift come from `calculateSessionParameters`, keyed on the candle's **Europe/Madrid** time (Frankfurt open, London, lunch lull, US macro data, overlap, etc.), scaled by a random `DayProfile` (trend/reversal/choppy) chosen in `resetSimulation`. Sessions start at 07:55. EUR/USD scales volatility by 0.15. Blind mode hides the auto-set parameters in the UI.

### Trades
- `MARKET_PRESETS` in `types.ts` (GENERIC, EURUSD, DAX) sets start price, all engine params, SL/TP points, `pipSize`, `pipValue`, `spread` and `pricePrecision`; `resetSimulation` applies them.
- PnL = `(priceDiff / pipSize) * pipValue`. Spread is applied as half on entry and half on exit.
- For market orders (button or A/S) with ATR enabled (the default), SL/TP are 3×ATR / 6×ATR instead of the preset points. Q/W limit orders always use the preset points.
- A `useEffect` on `candles` fills PENDING limit orders and closes on SL/TP (SL is checked first within a candle).
- Hotkeys (only in simulator views, ignored in inputs): Space play/pause, A/S market buy/sell, Q/W buy/sell limit at the last drawn price line, X close the latest open trade, C move SL to breakeven, D drawing mode, Z remove a price line, 1–0 tick speed (20 ms … 1000 ms).

### Charting
`components/FinancialChart.tsx` uses TradingView Lightweight Charts v5, loaded from unpkg in `index.html` as the global `window.LightweightCharts`. There is no npm package and no types, hence the `any` refs and `@ts-ignore`. The README's "custom Canvas charting" is out of date; only the pencil overlay is a raw canvas. The data effect normally calls `series.update()` with just the last point. It falls back to a full `setData()` when the candles shrink, the `timeframe` changes, or `dataVersion` changes. `chartDataVersion` in `App` is bumped whenever the series are rebuilt: on indicator settings changes, and on every reset, because a V3 prefill replaces the data with a window of the same length. `FinancialChart` (V1/V2) sizes its canvases once and only follows `window` resize events. The component is wrapped in `React.memo` with a custom comparator. **A new prop must be added to that comparator or the chart won't redraw when it changes.** Panels that must keep their canvas mounted are hidden with `visibility: hidden`, not `display: none` (see commit d3593b8, which fixed an RSI crash). Styling is Tailwind via the CDN `<script>` in `index.html`; there is no Tailwind config or PostCSS.

### Backend (optional)
`server/` is Express + `better-sqlite3`; the DB is at `server/data/quantflow.db` (gitignored), with the schema created inline in `server/db.ts` (`trades` plus `trade_snapshots` with ENTRY/EXIT rows). Routes: `/api/health` and `/api/trades` (POST, PATCH `/:id`, GET, GET `/:id`, DELETE `/:id`). Server-side imports use `.js` extensions (ESM run by `tsx`). The frontend client `services/tradeApi.ts` swallows every error and returns `null`, so the app must keep working with no server, which is how it runs on GitHub Pages. `tradeApi` calls are fire-and-forget; UI state never waits on them.

## Conventions
- Flat layout (no `src/`); path alias `@/*` → repo root
- Shared types and presets live in `types.ts`
- Conventional Commits; branch naming `<type>/<task-id>-<short-slug>`

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

## Agent Model Policy
- When implementing a plan (plan mode approved → execution), use **Sonnet 5.5** agents for the implementation work
- Same applies to `/dev-task` Phase 5 (Implement): spawn Sonnet 5.5 agents for coding
- Opus 5.5 stays in the driver seat for planning, review, and coordination
