import { CandleData, MacdData, RsiChartData } from '../types';
import { StreamingEMA, StreamingMACD, StreamingUltimateRSI, getMacdColor } from './indicators';

export interface ChartIndicatorSettings {
  emaPeriod: number;
  hma2Period: number;
  hmaPeriod: number;
  macd: { fast: number; slow: number; signal: number };
}

export interface TimeframeChartData {
  candles: CandleData[];
  emaData: { time: number; value: number }[];
  hma2Data: { time: number; value: number }[];
  hmaData: { time: number; value: number }[];
  macdData: MacdData[];
  rsiChartData: RsiChartData[];
}

const emptyChartData = (): TimeframeChartData => ({
  candles: [], emaData: [], hma2Data: [], hmaData: [], macdData: [], rsiChartData: [],
});

// Aggregates the 1m candle stream into a higher timeframe and keeps the chart indicators for it.
// The last bar is still forming: its indicator values are peeked, and the engines only advance
// once a candle from the next bucket arrives and closes it.
// Storage may run up to 2× maxBars before old bars are dropped in one splice, keeping push() O(1) amortized;
// getChartData() always returns at most maxBars.
export class TimeframeAggregator {
  private readonly seconds: number;
  private readonly maxBars: number;
  private data: TimeframeChartData = emptyChartData();
  private ema!: StreamingEMA;
  private ema2!: StreamingEMA;
  private ema3!: StreamingEMA;
  private macd!: StreamingMACD;
  private rsi!: StreamingUltimateRSI;

  constructor(seconds: number, settings: ChartIndicatorSettings, maxBars = 2000) {
    this.seconds = seconds;
    this.maxBars = maxBars;
    this.setSettings(settings);
  }

  push(candle: CandleData): void {
    const { candles } = this.data;
    const time = Math.floor(candle.time / this.seconds) * this.seconds;
    const forming = candles[candles.length - 1];

    if (forming && forming.time === time) {
      candles[candles.length - 1] = {
        time,
        open: forming.open,
        high: Math.max(forming.high, candle.high),
        low: Math.min(forming.low, candle.low),
        close: candle.close,
        volume: (forming.volume ?? 0) + (candle.volume ?? 0),
      };
      this.popIndicators();
    } else {
      if (forming) this.commit(forming.close);
      candles.push({ time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume ?? 0 });
    }
    this.pushIndicators(candles[candles.length - 1]);

    if (candles.length > this.maxBars * 2) this.keepLast(this.maxBars);
  }

  // Drops all but the newest n bars (indicator engines keep their state)
  keepLast(n: number): void {
    const excess = this.data.candles.length - n;
    if (excess > 0) Object.values(this.data).forEach(series => series.splice(0, excess));
  }

  // Recreates the indicator engines and replays the stored bars through them
  setSettings(settings: ChartIndicatorSettings): void {
    this.ema = new StreamingEMA(settings.emaPeriod);
    this.ema2 = new StreamingEMA(settings.hma2Period);
    this.ema3 = new StreamingEMA(settings.hmaPeriod);
    this.macd = new StreamingMACD(settings.macd.fast, settings.macd.slow, settings.macd.signal);
    this.rsi = new StreamingUltimateRSI(14, 14);

    const bars = this.data.candles;
    this.data = emptyChartData();
    bars.forEach(bar => this.push(bar));
  }

  // Fresh array references, so React and the chart's memo comparator see a change
  getChartData(): TimeframeChartData {
    const d = this.data;
    const from = -this.maxBars;
    return {
      candles: d.candles.slice(from),
      emaData: d.emaData.slice(from),
      hma2Data: d.hma2Data.slice(from),
      hmaData: d.hmaData.slice(from),
      macdData: d.macdData.slice(from),
      rsiChartData: d.rsiChartData.slice(from),
    };
  }

  getMacdData(): MacdData[] {
    return this.data.macdData.slice(-this.maxBars);
  }

  private commit(close: number): void {
    this.ema.next(close);
    this.ema2.next(close);
    this.ema3.next(close);
    this.macd.next(close);
    this.rsi.next(close);
  }

  private pushIndicators(bar: CandleData): void {
    const { time, close } = bar;
    const d = this.data;
    d.emaData.push({ time, value: this.ema.peek(close) });
    d.hma2Data.push({ time, value: this.ema2.peek(close) });
    d.hmaData.push({ time, value: this.ema3.peek(close) });
    const macd = this.macd.peek(close);
    const prevHist = d.macdData.length > 0 ? d.macdData[d.macdData.length - 1].value : 0;
    d.macdData.push({ time, value: macd.histogram, color: getMacdColor(macd.histogram, prevHist), signal: macd.signal, macd: macd.macd });
    const rsi = this.rsi.peek(close);
    d.rsiChartData.push({ time, rsi: rsi.rsi, signal: rsi.signal });
  }

  private popIndicators(): void {
    const d = this.data;
    d.emaData.pop();
    d.hma2Data.pop();
    d.hmaData.pop();
    d.macdData.pop();
    d.rsiChartData.pop();
  }
}
