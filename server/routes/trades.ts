import { Router, Request, Response } from 'express';
import db from '../db.js';

const router = Router();

// --- Prepared Statements ---
const insertTrade = db.prepare(`
  INSERT INTO trades (id, type, status, entry_price, entry_time, stop_loss, take_profit, market_preset, sim_type, session_label)
  VALUES (@id, @type, @status, @entryPrice, @entryTime, @stopLoss, @takeProfit, @marketPreset, @simType, @sessionLabel)
`);

const insertSnapshot = db.prepare(`
  INSERT INTO trade_snapshots (
    trade_id, snapshot_type,
    ema1, ema2, ema3,
    macd_value, macd_signal, macd_histogram, macd_trend,
    daily_bias_text, ema1h_trend, macd_vs_zero, macd_vs_signal,
    histogram_rising, divergence, rsi15, hist5_rising, hist3_rising,
    atr, drift_label, drift_pct,
    macd_fast, macd_slow, macd_signal_period,
    ema1h_fast, ema1h_slow, atr_period, rsi_len,
    rsi_value, rsi_signal, rsi_zone,
    current_atr, ema1_period, ema2_period, ema3_period
  ) VALUES (
    @tradeId, @snapshotType,
    @ema1, @ema2, @ema3,
    @macdValue, @macdSignal, @macdHistogram, @macdTrend,
    @dailyBiasText, @ema1hTrend, @macdVsZero, @macdVsSignal,
    @histogramRising, @divergence, @rsi15, @hist5Rising, @hist3Rising,
    @atr, @driftLabel, @driftPct,
    @macdFast, @macdSlow, @macdSignalPeriod,
    @ema1hFast, @ema1hSlow, @atrPeriod, @rsiLen,
    @rsiValue, @rsiSignal, @rsiZone,
    @currentAtr, @ema1Period, @ema2Period, @ema3Period
  )
`);

const updateTrade = db.prepare(`
  UPDATE trades SET
    status = @status,
    close_price = @closePrice,
    close_time = @closeTime,
    pnl = @pnl,
    exit_reason = @exitReason,
    updated_at = datetime('now')
  WHERE id = @id
`);

const selectTrades = db.prepare(`
  SELECT * FROM trades ORDER BY entry_time DESC LIMIT @limit OFFSET @offset
`);

const selectTradesByStatus = db.prepare(`
  SELECT * FROM trades WHERE status = @status ORDER BY entry_time DESC LIMIT @limit OFFSET @offset
`);

const countTrades = db.prepare(`SELECT COUNT(*) as total FROM trades`);
const countTradesByStatus = db.prepare(`SELECT COUNT(*) as total FROM trades WHERE status = @status`);

const selectTradeById = db.prepare(`SELECT * FROM trades WHERE id = @id`);
const selectSnapshots = db.prepare(`SELECT * FROM trade_snapshots WHERE trade_id = @tradeId ORDER BY snapshot_type`);
const deleteTrade = db.prepare(`DELETE FROM trades WHERE id = @id`);

// --- Helper to flatten snapshot payload into DB params ---
function flattenSnapshot(tradeId: string, snapshotType: 'ENTRY' | 'EXIT', snapshot: any) {
  const macd = snapshot.macd || {};
  const dash = snapshot.macdDashboard || {};
  const rsi = snapshot.rsiDashboard || {};
  const periods = snapshot.emaPeriods || {};
  return {
    tradeId,
    snapshotType,
    ema1: snapshot.ema1 ?? null,
    ema2: snapshot.ema2 ?? null,
    ema3: snapshot.ema3 ?? null,
    macdValue: macd.macd ?? null,
    macdSignal: macd.signal ?? null,
    macdHistogram: macd.histogram ?? null,
    macdTrend: macd.trend ?? null,
    dailyBiasText: dash.dailyBiasText ?? null,
    ema1hTrend: dash.ema1hTrend ?? null,
    macdVsZero: dash.macdVsZero ?? null,
    macdVsSignal: dash.macdVsSignal ?? null,
    histogramRising: dash.histogramRising != null ? (dash.histogramRising ? 1 : 0) : null,
    divergence: dash.divergence ?? null,
    rsi15: dash.rsi15 ?? null,
    hist5Rising: dash.hist5Rising != null ? (dash.hist5Rising ? 1 : 0) : null,
    hist3Rising: dash.hist3Rising != null ? (dash.hist3Rising ? 1 : 0) : null,
    atr: dash.atr ?? null,
    driftLabel: dash.driftLabel ?? null,
    driftPct: dash.driftPct ?? null,
    macdFast: dash.macdParams?.fast ?? null,
    macdSlow: dash.macdParams?.slow ?? null,
    macdSignalPeriod: dash.macdParams?.signal ?? null,
    ema1hFast: dash.ema1hParams?.fast ?? null,
    ema1hSlow: dash.ema1hParams?.slow ?? null,
    atrPeriod: dash.atrPeriod ?? null,
    rsiLen: dash.rsiLen ?? null,
    rsiValue: rsi.rsi ?? null,
    rsiSignal: rsi.signal ?? null,
    rsiZone: rsi.zone ?? null,
    currentAtr: snapshot.currentAtr ?? null,
    ema1Period: periods.ema1 ?? null,
    ema2Period: periods.ema2 ?? null,
    ema3Period: periods.ema3 ?? null,
  };
}

// --- POST /api/trades ---
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;

    const createAndSnapshot = db.transaction(() => {
      insertTrade.run({
        id: body.id,
        type: body.type,
        status: body.status,
        entryPrice: body.entryPrice,
        entryTime: body.entryTime,
        stopLoss: body.stopLoss ?? null,
        takeProfit: body.takeProfit ?? null,
        marketPreset: body.marketPreset,
        simType: body.simType,
        sessionLabel: body.sessionLabel ?? null,
      });

      if (body.snapshot) {
        insertSnapshot.run(flattenSnapshot(body.id, 'ENTRY', body.snapshot));
      }
    });

    createAndSnapshot();
    res.status(201).json({ trade: selectTradeById.get({ id: body.id }) });
  } catch (err: any) {
    console.error('[trades] POST error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// --- PATCH /api/trades/:id ---
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const updateAndSnapshot = db.transaction(() => {
      updateTrade.run({
        id,
        status: body.status,
        closePrice: body.closePrice ?? null,
        closeTime: body.closeTime ?? null,
        pnl: body.pnl ?? null,
        exitReason: body.exitReason ?? null,
      });

      if (body.exitSnapshot) {
        insertSnapshot.run(flattenSnapshot(id, 'EXIT', body.exitSnapshot));
      }
    });

    updateAndSnapshot();
    res.json({ trade: selectTradeById.get({ id }) });
  } catch (err: any) {
    console.error('[trades] PATCH error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// --- GET /api/trades ---
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    let trades, total;
    if (status) {
      trades = selectTradesByStatus.all({ status, limit, offset });
      total = (countTradesByStatus.get({ status }) as any).total;
    } else {
      trades = selectTrades.all({ limit, offset });
      total = (countTrades.get() as any).total;
    }

    res.json({ trades, total });
  } catch (err: any) {
    console.error('[trades] GET list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/trades/:id ---
router.get('/:id', (req: Request, res: Response) => {
  try {
    const trade = selectTradeById.get({ id: req.params.id });
    if (!trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }
    const snapshots = selectSnapshots.all({ tradeId: req.params.id });
    res.json({ trade, snapshots });
  } catch (err: any) {
    console.error('[trades] GET by id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/trades/:id ---
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = deleteTrade.run({ id: req.params.id });
    if (result.changes === 0) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    console.error('[trades] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
