
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

export class StreamingATR {
  private period: number;
  private prevClose: number | null = null;
  private atr: number | null = null;
  private trBuffer: number[] = [];

  constructor(period = 14) {
    this.period = period;
  }

  next(high: number, low: number, close: number): number {
    const tr = this.prevClose === null
      ? high - low
      : Math.max(high - low, Math.abs(high - this.prevClose), Math.abs(low - this.prevClose));
    this.prevClose = close;

    if (this.atr === null) {
      this.trBuffer.push(tr);
      if (this.trBuffer.length >= this.period) {
        this.atr = this.trBuffer.reduce((a, b) => a + b, 0) / this.period;
        this.trBuffer = [];
      }
      return this.trBuffer.length > 0
        ? this.trBuffer.reduce((a, b) => a + b, 0) / this.trBuffer.length
        : this.atr ?? 0;
    }
    // Wilder's smoothing (RMA)
    this.atr = (this.atr * (this.period - 1) + tr) / this.period;
    return this.atr;
  }

  reset() {
    this.prevClose = null;
    this.atr = null;
    this.trBuffer = [];
  }
}

// RMA (Wilder's smoothing) — same as EMA with k = 1/period
class StreamingRMA {
  private period: number;
  private value: number | null = null;

  constructor(period: number) {
    this.period = period;
  }

  next(x: number): number {
    if (this.value === null) {
      this.value = x;
    } else {
      this.value = (x + this.value * (this.period - 1)) / this.period;
    }
    return this.value;
  }

  reset() { this.value = null; }
}

export class StreamingUltimateRSI {
  private length: number;
  private buffer: number[] = [];       // rolling window of close prices
  private prevUpper: number | null = null;
  private prevLower: number | null = null;
  private prevSrc: number | null = null;
  private numRma: StreamingRMA;
  private denRma: StreamingRMA;
  private signalEma: StreamingEMA;

  constructor(length = 14, signalLength = 14) {
    this.length = length;
    this.numRma = new StreamingRMA(length);
    this.denRma = new StreamingRMA(length);
    this.signalEma = new StreamingEMA(signalLength);
  }

  next(close: number): { rsi: number; signal: number } {
    this.buffer.push(close);
    if (this.buffer.length > this.length) this.buffer.shift();

    const upper = Math.max(...this.buffer);
    const lower = Math.min(...this.buffer);
    const r = upper - lower;

    let diff: number;
    if (this.prevSrc === null || this.prevUpper === null || this.prevLower === null) {
      diff = 0;
    } else if (upper > this.prevUpper) {
      diff = r;
    } else if (lower < this.prevLower) {
      diff = -r;
    } else {
      diff = close - this.prevSrc;
    }

    this.prevUpper = upper;
    this.prevLower = lower;
    this.prevSrc = close;

    const num = this.numRma.next(diff);
    const den = this.denRma.next(Math.abs(diff));
    const arsi = den !== 0 ? (num / den) * 50 + 50 : 50;
    const signal = this.signalEma.next(arsi);

    return { rsi: arsi, signal };
  }

  reset() {
    this.buffer = [];
    this.prevUpper = null;
    this.prevLower = null;
    this.prevSrc = null;
    this.numRma.reset();
    this.denRma.reset();
    this.signalEma.reset();
  }
}
