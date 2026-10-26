import { CandleData, DaxParams, DEFAULT_DAX_PARAMS } from '../types';

// ─── Berlin (Xetra) time ────────────────────────────────────────────────────
// EU summer time runs from the last Sunday of March to the last Sunday of October, switching at 01:00 UTC.
// Computed directly because Intl is far too slow for generating tens of thousands of history candles.

const dstRanges = new Map<number, [number, number]>();

const lastSundayAt1Utc = (year: number, month: number): number => {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1) / 1000;
};

export function berlinOffsetSeconds(t: number): number {
  const year = new Date(t * 1000).getUTCFullYear();
  let range = dstRanges.get(year);
  if (!range) {
    range = [lastSundayAt1Utc(year, 2), lastSundayAt1Utc(year, 9)];
    dstRanges.set(year, range);
  }
  return t >= range[0] && t < range[1] ? 7200 : 3600;
}

// Berlin wall-clock parts; weekday 0 = Sunday
function berlinParts(t: number) {
  const local = t + berlinOffsetSeconds(t);
  const day = Math.floor(local / 86400);
  return { day, weekday: (day + 4) % 7, minute: Math.floor((local - day * 86400) / 60) };
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBerlinTime(t: number, withDate = false): string {
  const d = new Date((t + berlinOffsetSeconds(t)) * 1000);
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withDate ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hm}` : hm;
}

export function formatBerlinDate(t: number): string {
  const d = new Date((t + berlinOffsetSeconds(t)) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const berlinDay = (t: number) => Math.floor((t + berlinOffsetSeconds(t)) / 86400);

// Close of the last candle before the current Berlin session day (what TradingView's daily change is measured
// against), or null when the candles hold only one day. Candles are time-sorted, so the day boundary is found
// by binary search.
export function previousSessionClose(candles: CandleData[]): number | null {
  if (candles.length === 0) return null;
  const today = berlinDay(candles[candles.length - 1].time);
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (berlinDay(candles[mid].time) < today) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? candles[lo - 1].close : null;
}

// UTC timestamp of a Berlin wall-clock time on the given Berlin day number
function berlinTimeToUtc(day: number, minute: number): number {
  const guess = day * 86400 + minute * 60;
  return guess - berlinOffsetSeconds(guess - 3600);
}

// The most recent weekday at the given Berlin time, not after `now`
export function lastWeekdayAt(now: number, minute: number): number {
  let { day } = berlinParts(now);
  for (;;) {
    const weekday = (day + 4) % 7;
    const t = berlinTimeToUtc(day, minute);
    if (weekday !== 0 && weekday !== 6 && t <= now) return t;
    day--;
  }
}

// ─── Session model ──────────────────────────────────────────────────────────
// GER40 CFD hours: Mon–Fri 01:00–22:00 Berlin. No candles outside the session.

const SESSION_OPEN = 60;
const SESSION_CLOSE = 22 * 60;
const XETRA_OPEN = 9 * 60;
const US_DATA = 14 * 60 + 30;
const US_OPEN = 15 * 60 + 30;
const XETRA_CLOSE = 17 * 60 + 30;
const SUBSTEPS = 6; // intra-minute path steps used to build realistic wicks

// Relative per-minute volatility by Berlin time, before news. Normal day ≈ Xetra open and US open dominate.
function baseActivity(m: number): number {
  let a: number;
  if (m < 7 * 60) a = 0.28;
  else if (m < 8 * 60) a = 0.42;
  else if (m < XETRA_OPEN) a = 0.75;
  else if (m < 11 * 60 + 30) a = 1.0;
  else if (m < US_DATA) a = 0.68;
  else if (m < US_OPEN) a = 0.95;
  else if (m < XETRA_CLOSE) a = 1.15;
  else if (m < 20 * 60) a = 0.62;
  else a = 0.45;
  if (m >= 8 * 60) a += 0.4 * Math.exp(-(m - 8 * 60) / 15);           // futures pre-market open
  if (m >= XETRA_OPEN) a += 1.5 * Math.exp(-(m - XETRA_OPEN) / 18);  // Xetra opening auction
  if (m >= XETRA_CLOSE - 5 && m < XETRA_CLOSE + 5) a += 0.5;          // closing auction
  return a;
}

function newsActivity(m: number, news: number): number {
  let a = 0;
  if (m >= US_DATA) a += news * 2.2 * Math.exp(-(m - US_DATA) / 6);
  if (m >= US_OPEN) a += news * 1.2 * Math.exp(-(m - US_OPEN) / 25);
  return a;
}

export function getDaxSessionLabel(t: number): string {
  const { minute: m } = berlinParts(t);
  if (m < 8 * 60) return '🌏 ASIA';
  if (m < XETRA_OPEN) return '🇩🇪 PRE-MARKET';
  if (m < XETRA_OPEN + 30) return '🔔 XETRA OPEN';
  if (m < 11 * 60 + 30) return '🇪🇺 EUROPE';
  if (m < US_DATA) return '🍽️ LUNCH';
  if (m < US_OPEN) return '📊 US DATA';
  if (m < US_OPEN + 30) return '🇺🇸 US OPEN';
  if (m < XETRA_CLOSE) return '⚡ EU/US OVERLAP';
  if (m < XETRA_CLOSE + 5) return '🔔 XETRA CLOSE';
  return '🇺🇸 US SESSION';
}

type DayType = 'TREND' | 'REVERSAL' | 'RANGE';

interface DayState {
  day: number;
  type: DayType;
  dir: 1 | -1;
  strength: number;  // total log move a trend/reversal day aims for
  pivot: number;     // minute of day where a reversal day turns
  news: number;      // 0..1 size of the US data / US open spikes today
  volFactor: number; // calm vs wild day
  anchor: number;    // log price range days revert to
}

// Mulberry32 — small seeded PRNG so a session can be reproduced from its seed
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * GER40 (DAX) minute-candle generator:
 * - intraday volatility seasonality (Xetra open, lunch, 14:30 US data, 15:30 US open, Xetra close)
 * - GARCH(1,1) volatility clustering on deseasonalized returns, Student-t (ν=4) fat tails
 * - daily regimes (trend / reversal / range) whose drift follows market activity
 * - a multi-day regime drift that gives the 4h chart its swings, plus session-open gaps
 */
export class DaxEngine {
  private params: DaxParams;
  private readonly rand: () => number;
  private spareNormal: number | null = null;

  private logPrice: number;        // efficient (fundamental) log price
  private noise = 0;               // fast mean-reverting microstructure noise on top of it
  private time: number;            // start of the next minute to generate
  private lastCandleTime: number | null = null;
  private garch = 1;               // conditional variance multiplier, long-run mean 1
  private sigmaBase = 0;           // per-minute σ for activity 1, set from dailyVolPct
  private activityNorm = 1;        // Σ activity over a session, for spreading a day's drift
  private dayState: DayState | null = null;
  private regimeDrift = 0;         // per-minute log drift of the current multi-day regime
  private regimeDaysLeft = 0;

  constructor(startPrice: number, startTime: number, params: DaxParams = DEFAULT_DAX_PARAMS, seed?: number) {
    this.rand = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 32));
    this.params = params;
    this.logPrice = Math.log(startPrice);
    this.time = Math.floor(startTime / 60) * 60;
    this.calibrate();
  }

  setParams(params: DaxParams): void {
    if (params === this.params) return;
    this.params = params;
    this.calibrate();
  }

  // Per-minute σ such that a session with average news has the target daily volatility
  private calibrate(): void {
    const news = this.params.newsIntensity * 0.6;
    let variance = 0;
    let activity = 0;
    for (let m = SESSION_OPEN; m < SESSION_CLOSE; m++) {
      const a = baseActivity(m) + newsActivity(m, news);
      variance += a * a;
      activity += a;
    }
    this.sigmaBase = (this.params.dailyVolPct / 100) / Math.sqrt(variance);
    this.activityNorm = activity;
  }

  private normal(): number {
    if (this.spareNormal !== null) {
      const z = this.spareNormal;
      this.spareNormal = null;
      return z;
    }
    let u = 0;
    while (u === 0) u = this.rand();
    const v = this.rand();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareNormal = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  // Scale that turns a normal into a unit-variance Student-t(4): sqrt((ν-2)/χ²_ν), χ²_4 = -2·ln(U1·U2)
  private tScale(): number {
    let u = 0;
    while (u === 0) u = this.rand() * this.rand();
    return Math.min(4, Math.sqrt(2 / (-2 * Math.log(u))));
  }

  // First session minute at or after t
  private nextSessionMinute(t: number): number {
    for (;;) {
      const { day, weekday, minute } = berlinParts(t);
      if (weekday === 0 || weekday === 6 || minute >= SESSION_CLOSE) {
        t = berlinTimeToUtc(day + 1, SESSION_OPEN);
      } else if (minute < SESSION_OPEN) {
        t = berlinTimeToUtc(day, SESSION_OPEN);
      } else {
        return t;
      }
    }
  }

  private startDay(day: number, weekday: number): void {
    const { trendiness, newsIntensity, dailyVolPct } = this.params;
    const dailyVol = dailyVolPct / 100;

    if (this.regimeDaysLeft <= 0) {
      // Multi-day swing: a few days of persistent drift, the structure seen on the 4h chart
      this.regimeDaysLeft = 3 + Math.floor(this.rand() * 6);
      this.regimeDrift = (this.normal() * 0.35 * dailyVol + 0.0003) / (SESSION_CLOSE - SESSION_OPEN);
    }
    this.regimeDaysLeft--;

    const r = this.rand();
    const pTrend = 0.2 + 0.35 * trendiness;
    const type: DayType = r < pTrend ? 'TREND' : r < pTrend + 0.2 ? 'REVERSAL' : 'RANGE';
    const withRegime = this.rand() < 0.6;
    const regimeSign: 1 | -1 = this.regimeDrift >= 0 ? 1 : -1;
    const prevVol = this.dayState?.volFactor ?? 1;

    // Session-open gap (bigger after the weekend)
    if (this.dayState) this.logPrice += this.normal() * dailyVol * (weekday === 1 ? 0.45 : 0.2);

    this.dayState = {
      day,
      type,
      dir: withRegime ? regimeSign : (-regimeSign as 1 | -1),
      strength: (0.4 + 0.8 * this.rand()) * dailyVol * (0.6 + 0.8 * trendiness),
      pivot: 11 * 60 + Math.floor(this.rand() * 270),
      news: newsIntensity * (this.rand() < 0.5 ? 1 : 0.25),
      volFactor: Math.exp(0.6 * Math.log(prevVol) + 0.25 * this.normal()),
      anchor: this.logPrice,
    };
  }

  private drift(minute: number, activity: number): number {
    const d = this.dayState!;
    let mu = this.regimeDrift;
    if (d.type === 'TREND') {
      mu += d.dir * d.strength * activity / this.activityNorm;
    } else if (d.type === 'REVERSAL') {
      mu += (minute < d.pivot ? d.dir : -1.3 * d.dir) * d.strength * activity / this.activityNorm;
    } else {
      mu -= 0.004 * (this.logPrice - d.anchor);
    }
    return mu;
  }

  nextTick(): CandleData {
    const time = this.nextSessionMinute(this.time);
    const { day, weekday, minute } = berlinParts(time);
    if (!this.dayState || this.dayState.day !== day) this.startDay(day, weekday);
    const d = this.dayState!;
    if (d.type === 'RANGE' && minute === XETRA_OPEN) d.anchor = this.logPrice;

    const activity = baseActivity(minute) + newsActivity(minute, d.news);
    const sigma = this.sigmaBase * activity * d.volFactor * Math.sqrt(this.garch);
    const mu = this.drift(minute, activity);

    // Intra-minute path: one fat-tail scale for the whole minute, normal sub-steps.
    // Observed price = efficient price + microstructure noise, which widens 1m candles
    // the way real index ticks do without changing daily volatility.
    const scale = this.tScale();
    const stepSigma = sigma * scale / Math.sqrt(SUBSTEPS);
    const efficientOpen = this.logPrice;
    const open = efficientOpen + this.noise;
    let p = efficientOpen;
    let n = this.noise;
    let hi = open;
    let lo = open;
    for (let i = 0; i < SUBSTEPS; i++) {
      p += mu / SUBSTEPS + stepSigma * this.normal();
      n = 0.6 * n + 0.9 * stepSigma * this.normal();
      if (p + n > hi) hi = p + n;
      if (p + n < lo) lo = p + n;
    }
    const close = p + n;

    // GARCH(1,1) update on the standardized minute shock
    const z2 = Math.min(64, ((p - efficientOpen - mu) / (sigma || 1e-12)) ** 2);
    const alpha = 0.03;
    const beta = 0.965;
    this.garch = Math.min(9, Math.max(0.2, (1 - alpha - beta) + this.garch * (alpha * z2 + beta)));

    this.logPrice = p;
    this.noise = n;
    this.time = time + 60;
    this.lastCandleTime = time;

    const round = (x: number) => Math.round(Math.exp(x) * 10) / 10;
    const relMove = Math.abs(close - open) / (sigma || 1e-12);
    const volume = Math.max(1, Math.round(260 * Math.pow(activity * d.volFactor, 1.3) * (0.6 + 0.4 * relMove) * Math.exp(0.35 * this.normal())));

    return { time, open: round(open), high: round(hi), low: round(lo), close: round(close), volume };
  }

  // Time of the candle the next nextTick() call will produce
  nextCandleTime(): number {
    return this.nextSessionMinute(this.time);
  }

  getCurrentPrice(): number {
    return Math.round(Math.exp(this.logPrice + this.noise) * 10) / 10;
  }

  getCurrentTime(): number {
    return this.lastCandleTime ?? this.time;
  }

  getSessionLabel(): string {
    return getDaxSessionLabel(this.getCurrentTime());
  }
}
