import { CandleData } from '../types';

export class MomentumEngine {
  private currentPrice: number;
  private currentTime: number;
  private prevReturn: number = 0;

  constructor(initialPrice: number, startTime: number = Math.floor(Date.now() / 1000)) {
    this.currentPrice = initialPrice;
    this.currentTime = startTime;
  }

  private getStandardNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  public nextTick(drift: number, volatility: number, trendStrength: number, timeStepInSeconds: number = 60): CandleData {
    trendStrength = Math.max(0, Math.min(1, trendStrength));
    const Z = this.getStandardNormal();
    // Autocorrelated return: blend previous return with fresh GBM shock
    const r = trendStrength * this.prevReturn + (1 - trendStrength) * (volatility * Z);
    this.prevReturn = r;

    const prevClose = this.currentPrice;
    const close = prevClose * Math.exp(drift) * Math.exp(r);

    const noise = Math.abs(this.getStandardNormal() * volatility * prevClose * 0.5);
    const open = prevClose;
    const high = Math.max(open, close) + noise;
    const low = Math.max(0.00001, Math.min(open, close) - noise);

    this.currentPrice = close;
    this.currentTime += timeStepInSeconds;

    return { time: this.currentTime, open, high, low, close };
  }

  public getCurrentPrice(): number { return this.currentPrice; }
  public getCurrentTime(): number { return this.currentTime; }
}
