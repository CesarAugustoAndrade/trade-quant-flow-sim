


export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export interface CandleData {
  time: number; // UNIX timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MacdData {
  time: number;
  value: number; // Histogram value
  color: string;
  signal: number;
  macd: number;
}

export interface TradeSnapshot {
  ema1: number;
  ema2: number;
  ema3: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'Positive Growing' | 'Positive Shrinking' | 'Negative Growing' | 'Negative Shrinking' | 'Neutral';
  };
  macdDashboard?: MacdDashboardData;
  rsiDashboard?: RsiDashboardData;
  currentAtr?: number;
  emaPeriods?: { ema1: number; ema2: number; ema3: number };
}

export interface Trade {
  id: string;
  type: TradeType;
  entryPrice: number;
  entryTime: number; // UNIX timestamp
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  closePrice?: number;
  closeTime?: number;
  pnl?: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason?: 'MANUAL' | 'TP' | 'SL';
  snapshot?: TradeSnapshot;
}

export interface SessionStats {
  winRate: number;
  avgRR: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  totalPips: number;
  avgDurationMinutes: number;
}

export interface RsiDashboardData {
  rsi: number;
  signal: number;
  zone: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  length: number;
  signalLength: number;
}

export interface RsiChartData {
  time: number;
  rsi: number;
  signal: number;
}

export interface MacdDashboardData {
  dailyBiasText: string;
  dailyBiasColor: string;
  ema1hTrend: 'BULLISH' | 'BEARISH';
  macdVsZero: number;
  macdVsSignal: number;
  histogramRising: boolean;
  divergence: 'BULLISH' | 'BEARISH' | 'BULL + BEAR' | 'None';
  rsi15: number;
  rsiColor: string;
  hist5Rising: boolean;
  hist3Rising: boolean;
  atr: number;
  driftLabel: string;
  driftPct: number;
  driftColor: string;
  macdParams: { fast: number; slow: number; signal: number };
  ema1hParams: { fast: number; slow: number };
  atrPeriod: number;
  rsiLen: number;
}

export interface MarketConfig {
  volatility: number;
  drift: number;
  tickSpeedMs: number;
  startPrice: number;
}

export enum SimulationType {
  GBM = 'GBM',
  MOMENTUM = 'MOMENTUM',
  OU = 'OU',
  GARCH = 'GARCH',
}

export enum MarketPreset {
  GENERIC = 'GENERIC',
  EURUSD = 'EURUSD',
}

export interface MarketPresetConfig {
  preset: MarketPreset;
  label: string;
  startPrice: number;
  volatility: number;
  drift: number;
  slPoints: number;
  tpPoints: number;
  ouMeanLevel: number;
  ouReversionSpeed: number;
  ouVolatility: number;
  momentumVolatility: number;
  momentumTrendStrength: number;
  momentumDrift: number;
  garchOmega: number;
  garchAlpha: number;
  garchBeta: number;
  garchDrift: number;
  pricePrecision: number;
  pipSize: number;
  pipValue: number;
  spread: number;
}

export const MARKET_PRESETS: Record<MarketPreset, MarketPresetConfig> = {
  [MarketPreset.GENERIC]: {
    preset: MarketPreset.GENERIC,
    label: 'Generic',
    startPrice: 1105,
    volatility: 0.002,
    drift: 0.0001,
    slPoints: 1,
    tpPoints: 2,
    ouMeanLevel: 1105,
    ouReversionSpeed: 0.01,
    ouVolatility: 1.5,
    momentumVolatility: 0.002,
    momentumTrendStrength: 0.6,
    momentumDrift: 0.0001,
    garchOmega: 0.000001,
    garchAlpha: 0.10,
    garchBeta: 0.85,
    garchDrift: 0.0001,
    pricePrecision: 2,
    pipSize: 1,
    pipValue: 1,
    spread: 1,
  },
  [MarketPreset.EURUSD]: {
    preset: MarketPreset.EURUSD,
    label: 'EUR/USD',
    startPrice: 1.0850,
    volatility: 0.0003,
    drift: 0.000005,
    slPoints: 0.0015,       // 15 pips — realistic intraday SL
    tpPoints: 0.003,        // 30 pips — 2:1 R:R
    ouMeanLevel: 1.0850,
    ouReversionSpeed: 0.008,
    ouVolatility: 0.0003,   // ~3 pip noise per tick (was 0.0008 = 8 pips)
    momentumVolatility: 0.0003,
    momentumTrendStrength: 0.55,
    momentumDrift: 0.000005,
    garchOmega: 0.0000001,
    garchAlpha: 0.08,
    garchBeta: 0.88,
    garchDrift: 0.000005,
    pricePrecision: 5,
    pipSize: 0.0001,
    pipValue: 1,            // $1 per pip (micro lot)
    spread: 0.00010,
  },
};