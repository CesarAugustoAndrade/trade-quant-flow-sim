import { CandleData } from '../types';

export class OUEngine {
  private currentPrice: number;
  private currentTime: number;

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

  public nextTick(meanLevel: number, reversionSpeed: number, volatility: number, timeStepInSeconds: number = 60): CandleData {
    if (reversionSpeed <= 0 || reversionSpeed >= 1) {
      reversionSpeed = Math.min(0.99, Math.max(0.001, reversionSpeed));
    }

    const Z = this.getStandardNormal();
    // Ornstein-Uhlenbeck discrete: S_{t+1} = S_t + theta*(mu - S_t) + sigma*Z
    const prevClose = this.currentPrice;
    const close = Math.max(prevClose + reversionSpeed * (meanLevel - prevClose) + volatility * Z, 0.0001);

    const noise = Math.abs(this.getStandardNormal() * volatility * 0.5);
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
