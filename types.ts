
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
  ema: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'Positive Growing' | 'Positive Shrinking' | 'Negative Growing' | 'Negative Shrinking' | 'Neutral';
  };
}

export interface Trade {
  id: string;
  type: TradeType;
  entryPrice: number;
  entryTime: number; // UNIX timestamp
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  closeTime?: number;
  pnl?: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason?: 'MANUAL' | 'TP' | 'SL';
  snapshot?: TradeSnapshot;
}

export interface MarketConfig {
  volatility: number;
  drift: number;
  tickSpeedMs: number;
  startPrice: number;
}

export interface ChartZone {
  id: string;
  startPrice: number;
  startTime: number;
  endPrice: number;
  endTime: number;
  color: string;
}
