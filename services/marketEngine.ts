import { CandleData } from '../types';

export class MarketEngine {
  private currentPrice: number;
  private currentTime: number;

  constructor(initialPrice: number, startTime: number = Math.floor(Date.now() / 1000)) {
    this.currentPrice = initialPrice;
    this.currentTime = startTime;
  }

  // Helper: Box-Muller transform for standard normal distribution
  private getStandardNormal(): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  }

  // The GBM Step
  // dt: time step (e.g., 1/252 for a day). We'll use small fractions for minute candles.
  private getNextPrice(currentPrice: number, dt: number, drift: number, volatility: number): number {
    const shock = this.getStandardNormal(); // dW_t
    
    // GBM Formula: S(t+dt) = S(t) * exp( (mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z )
    const exponent = (drift - 0.5 * Math.pow(volatility, 2)) * dt + volatility * Math.sqrt(dt) * shock;
    
    return currentPrice * Math.exp(exponent);
  }

  public nextTick(drift: number, volatility: number, timeStepInSeconds: number = 60): CandleData {
    // We treat 'dt' as a fraction of a trading year for standard GBM parameters typically
    // But for a visual sim, we can treat dt = 1 as one unit of time. 
    // To make the inputs intuitive: Volatility of 0.02 means ~2% swing potential per unit.
    // Let's normalize dt to be small to simulate continuous movement.
    const dt = 1; 

    const prevClose = this.currentPrice;
    
    // Simulate OHLC based on the movement
    // We generate a "Close" using GBM
    const nextClose = this.getNextPrice(prevClose, dt, drift, volatility);
    
    // To generate High/Low, we add some intra-candle noise
    const noise = Math.abs(this.getStandardNormal() * volatility * prevClose * 0.5);
    
    const open = prevClose;
    const close = nextClose;
    const high = Math.max(open, close) + noise;
    const low = Math.max(0.00001, Math.min(open, close) - noise);

    this.currentPrice = close;
    this.currentTime += timeStepInSeconds;

    return {
      time: this.currentTime,
      open,
      high,
      low,
      close
    };
  }

  public getCurrentPrice(): number {
    return this.currentPrice;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }
}