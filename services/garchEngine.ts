import { CandleData } from '../types';

export class GARCHEngine {
  private currentPrice: number;
  private currentTime: number;
  private prevEps: number = 0;
  private currentVariance: number;
  private readonly initialVol: number;

  constructor(initialPrice: number, startTime: number = Math.floor(Date.now() / 1000), initialVol: number = 0.002) {
    this.currentPrice = initialPrice;
    this.currentTime = startTime;
    this.initialVol = initialVol;
    this.currentVariance = initialVol * initialVol;
  }

  private getStandardNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  public nextTick(drift: number, omega: number, alpha: number, beta: number, timeStepInSeconds: number = 60): CandleData {
    // Clamp alpha+beta < 1 for stationarity
    const ab = alpha + beta;
    if (ab >= 1) {
      alpha = alpha / (ab + 0.01);
      beta = beta / (ab + 0.01);
    }

    // GARCH(1,1): sigma^2_t = omega + alpha*eps^2_{t-1} + beta*sigma^2_{t-1}
    const variance = omega + alpha * this.prevEps * this.prevEps + beta * this.currentVariance;
    const sigma = Math.sqrt(variance);

    const Z = this.getStandardNormal();
    const r = drift + sigma * Z;
    const eps = sigma * Z; // innovation

    const prevClose = this.currentPrice;
    const close = prevClose * Math.exp(r - 0.5 * variance);

    const noise = Math.abs(this.getStandardNormal() * sigma * prevClose * 0.5);
    const open = prevClose;
    const high = Math.max(open, close) + noise;
    const low = Math.max(0.00001, Math.min(open, close) - noise);

    this.prevEps = eps;
    this.currentVariance = variance;
    this.currentPrice = close;
    this.currentTime += timeStepInSeconds;

    return { time: this.currentTime, open, high, low, close };
  }

  public getCurrentPrice(): number { return this.currentPrice; }
  public getCurrentTime(): number { return this.currentTime; }
  public getCurrentSigma(): number { return Math.sqrt(this.currentVariance); }
}
