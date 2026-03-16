
export class StreamingMACD {
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  
  private emaFast: number | null = null;
  private emaSlow: number | null = null;
  private emaSignal: number | null = null;

  constructor(fast = 35, slow = 115, signal = 18) {
    this.fastPeriod = fast;
    this.slowPeriod = slow;
    this.signalPeriod = signal;
  }

  // Update parameters dynamically
  setPeriods(fast: number, slow: number, signal: number) {
    this.fastPeriod = fast;
    this.slowPeriod = slow;
    this.signalPeriod = signal;
  }

  // Calculate EMA
  private updateEMA(currentVal: number, prevEma: number | null, period: number): number {
    if (prevEma === null) return currentVal;
    const k = 2 / (period + 1);
    return (currentVal - prevEma) * k + prevEma;
  }

  // Process a new close price and return full MACD set
  next(closePrice: number): { macd: number; signal: number; histogram: number } {
    this.emaFast = this.updateEMA(closePrice, this.emaFast, this.fastPeriod);
    this.emaSlow = this.updateEMA(closePrice, this.emaSlow, this.slowPeriod);

    const macdLine = this.emaFast - this.emaSlow;
    
    this.emaSignal = this.updateEMA(macdLine, this.emaSignal, this.signalPeriod);
    
    const histogram = macdLine - this.emaSignal;

    return {
      macd: macdLine,
      signal: this.emaSignal,
      histogram: histogram
    };
  }

  reset() {
    this.emaFast = null;
    this.emaSlow = null;
    this.emaSignal = null;
  }
}

export class StreamingEMA {
  private period: number;
  private k: number;
  private currentEma: number | null = null;

  constructor(period: number) {
    this.period = period;
    this.k = 2 / (period + 1);
  }

  setPeriod(newPeriod: number) {
    if (this.period !== newPeriod) {
        this.period = newPeriod;
        this.k = 2 / (newPeriod + 1);
        // We don't reset currentEma to avoid jagged jumps, 
        // it will smooth out over the next few ticks
    }
  }

  next(price: number): number {
    if (this.currentEma === null) {
      this.currentEma = price;
    } else {
      this.currentEma = price * this.k + this.currentEma * (1 - this.k);
    }
    return this.currentEma;
  }

  reset() {
    this.currentEma = null;
  }
}

export class StreamingWMA {
  private period: number;
  private buffer: number[] = [];
  
  constructor(period: number) {
    this.period = period;
  }

  setPeriod(newPeriod: number) {
    if (this.period !== newPeriod) {
      this.period = newPeriod;
      this.buffer = []; // Reset buffer on period change
    }
  }

  next(price: number): number {
    this.buffer.push(price);
    if (this.buffer.length > this.period) {
      this.buffer.shift();
    }

    // Standard WMA Calculation: Sum(Price * Weight) / Sum(Weights)
    // If buffer is not full, we calculate WMA on available data (ramp up)
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < this.buffer.length; i++) {
      const weight = i + 1;
      numerator += this.buffer[i] * weight;
      denominator += weight;
    }

    return numerator / denominator;
  }

  reset() {
    this.buffer = [];
  }
}

export class StreamingHMA {
  private period: number;
  private wmaHalf: StreamingWMA;
  private wmaFull: StreamingWMA;
  private wmaSmooth: StreamingWMA;

  constructor(period: number) {
    this.period = period;
    this.wmaHalf = new StreamingWMA(Math.floor(period / 2));
    this.wmaFull = new StreamingWMA(period);
    this.wmaSmooth = new StreamingWMA(Math.floor(Math.sqrt(period)));
  }

  setPeriod(newPeriod: number) {
    if (this.period !== newPeriod) {
      this.period = newPeriod;
      this.wmaHalf.setPeriod(Math.floor(newPeriod / 2));
      this.wmaFull.setPeriod(newPeriod);
      this.wmaSmooth.setPeriod(Math.floor(Math.sqrt(newPeriod)));
    }
  }

  next(price: number): { value: number; band: number } {
    const valHalf = this.wmaHalf.next(price);
    const valFull = this.wmaFull.next(price);
    
    const rawHMA = (2 * valHalf) - valFull;
    
    const hma = this.wmaSmooth.next(rawHMA);
    return { value: hma, band: hma };
  }

  reset() {
    this.wmaHalf.reset();
    this.wmaFull.reset();
    this.wmaSmooth.reset();
  }
}
