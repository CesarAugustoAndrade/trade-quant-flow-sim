import { CandleData, MacdData, RsiChartData } from '../types';
import { StreamingEMA, StreamingMACD, StreamingUltimateRSI, getMacdColor } from './indicators';

const MAX_BARS = 2000;

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
export class TimeframeAggregator {
  private readonly seconds: number;
  private data: TimeframeChartData = emptyChartData();
  private ema!: StreamingEMA;
  private ema2!: StreamingEMA;
  private ema3!: StreamingEMA;
  private macd!: StreamingMACD;
  private rsi!: StreamingUltimateRSI;

  constructor(seconds: number, settings: ChartIndicatorSettings) {
    this.seconds = seconds;
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
      };
      this.popIndicators();
    } else {
      if (forming) this.commit(forming.close);
      candles.push({ time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
    }
    this.pushIndicators(candles[candles.length - 1]);

    if (candles.length > MAX_BARS) {
      Object.values(this.data).forEach(series => series.shift());
    }
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
    return {
      candles: [...d.candles],
      emaData: [...d.emaData],
      hma2Data: [...d.hma2Data],
      hmaData: [...d.hmaData],
      macdData: [...d.macdData],
      rsiChartData: [...d.rsiChartData],
    };
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
