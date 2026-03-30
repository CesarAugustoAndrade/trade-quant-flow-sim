import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarketEngine } from './services/marketEngine';
import { MomentumEngine } from './services/momentumEngine';
import { OUEngine } from './services/ouEngine';
import { GARCHEngine } from './services/garchEngine';
import { StreamingMACD, StreamingEMA, StreamingHMA, StreamingATR, StreamingUltimateRSI } from './services/indicators';
import { SimulationMenu } from './components/SimulationMenu';
import { SimulatorView } from './components/SimulatorView';
import { SimulatorViewV2 } from './components/SimulatorViewV2';
import { CandleData, MacdData, Trade, TradeType, MarketConfig, TradeSnapshot, SimulationType, MarketPreset, MARKET_PRESETS, SessionStats, MacdDashboardData, RsiDashboardData } from './types';

const CANDLE_TIME_STEP = 60;

enum DayProfile {
  TREND_UP = 'TREND_UP',
  TREND_DOWN = 'TREND_DOWN',
  REVERSAL_UP = 'REVERSAL_UP',
  REVERSAL_DOWN = 'REVERSAL_DOWN',
  CHOPPY = 'CHOPPY'
}

const getMacdColor = (current: number, previous: number) => {
  if (current >= 0) {
    return current >= previous ? '#26a69a' : '#b2dfdb';
  } else {
    return current < previous ? '#ef5350' : '#ffcdd2';
  }
};

function computeMacdDashboard(
  last15Macd: { macd: number; signal: number; histogram: number },
  prev15Macd: { macd: number; signal: number; histogram: number },
  ema1h35: number,
  ema1h115: number,
  atr: number,
  macd15Bars: Array<{ close: number; macd: number }>,
  macdSettings: { fast: number; slow: number; signal: number },
  atrPeriod: number,
): MacdDashboardData {
  const ema1hTrend: MacdDashboardData['ema1hTrend'] = ema1h35 > ema1h115 ? 'BULLISH' : 'BEARISH';
  const macdVsZero = last15Macd.macd;
  const macdVsSignal = last15Macd.macd - last15Macd.signal;
  const histogramRising = last15Macd.histogram > prev15Macd.histogram;

  // Divergence detection on closed 15m bars (price vs MACD)
  const pivotLen = 5;
  const divLookback = 200;
  let bullDiv = false;
  let bearDiv = false;

  if (macd15Bars.length > pivotLen * 2 + 2) {
    // Find pivot lows and highs for BOTH price and MACD
    const priceLows: { idx: number; val: number }[] = [];
    const priceHighs: { idx: number; val: number }[] = [];
    const macdLows: { idx: number; val: number }[] = [];
    const macdHighs: { idx: number; val: number }[] = [];

    for (let i = pivotLen; i < macd15Bars.length - pivotLen; i++) {
      let isPriceLow = true, isPriceHigh = true;
      let isMacdLow = true, isMacdHigh = true;
      for (let j = 1; j <= pivotLen; j++) {
        const bar = macd15Bars[i], barL = macd15Bars[i - j], barR = macd15Bars[i + j];
        if (bar.close >= barL.close || bar.close >= barR.close) isPriceLow = false;
        if (bar.close <= barL.close || bar.close <= barR.close) isPriceHigh = false;
        if (bar.macd >= barL.macd || bar.macd >= barR.macd) isMacdLow = false;
        if (bar.macd <= barL.macd || bar.macd <= barR.macd) isMacdHigh = false;
      }
      if (isPriceLow) priceLows.push({ idx: i, val: macd15Bars[i].close });
      if (isPriceHigh) priceHighs.push({ idx: i, val: macd15Bars[i].close });
      if (isMacdLow) macdLows.push({ idx: i, val: macd15Bars[i].macd });
      if (isMacdHigh) macdHighs.push({ idx: i, val: macd15Bars[i].macd });
    }

    // Bullish divergence: price lower low + MACD higher low (within lookback)
    if (priceLows.length >= 2 && macdLows.length >= 2) {
      const pl1 = priceLows[priceLows.length - 2], pl2 = priceLows[priceLows.length - 1];
      const ml1 = macdLows[macdLows.length - 2], ml2 = macdLows[macdLows.length - 1];
      if (pl2.val < pl1.val && ml2.val > ml1.val &&
          Math.max(pl2.idx, ml2.idx) - Math.min(pl1.idx, ml1.idx) <= divLookback) {
        bullDiv = true;
      }
    }

    // Bearish divergence: price higher high + MACD lower high (within lookback)
    if (priceHighs.length >= 2 && macdHighs.length >= 2) {
      const ph1 = priceHighs[priceHighs.length - 2], ph2 = priceHighs[priceHighs.length - 1];
      const mh1 = macdHighs[macdHighs.length - 2], mh2 = macdHighs[macdHighs.length - 1];
      if (ph2.val > ph1.val && mh2.val < mh1.val &&
          Math.max(ph2.idx, mh2.idx) - Math.min(ph1.idx, mh1.idx) <= divLookback) {
        bearDiv = true;
      }
    }
  }

  const divergence: MacdDashboardData['divergence'] =
    bullDiv && bearDiv ? 'BULL + BEAR' : bullDiv ? 'BULLISH' : bearDiv ? 'BEARISH' : 'None';

  // Drift score
  const hourlyBullish = ema1h35 > ema1h115;
  const wMacdVsSignal = 0.40;
  const wMacdVsZero = 0.25;
  const wHistogram = 0.10;
  const wHourlyTrend = 0.25;
  const wDivergence = 0.20;

  const driftSignal = macdVsSignal >= 0 ? wMacdVsSignal : -wMacdVsSignal;
  const driftZero = macdVsZero >= 0 ? wMacdVsZero : -wMacdVsZero;
  const driftHist = histogramRising ? wHistogram : -wHistogram;
  const driftHourly = hourlyBullish ? wHourlyTrend : -wHourlyTrend;
  const driftDiv = bullDiv ? wDivergence : bearDiv ? -wDivergence : 0;

  const driftScore = driftSignal + driftZero + driftHist + driftHourly + driftDiv;
  const driftPct = driftScore * 100;

  const driftLabel = driftScore > 0.5 ? 'STRONG BULL' : driftScore > 0.15 ? 'LEAN BULL' : driftScore > -0.15 ? 'NEUTRAL' : driftScore > -0.5 ? 'LEAN BEAR' : 'STRONG BEAR';
  const driftColor = driftScore > 0.5 ? '#089981' : driftScore > 0.15 ? '#26a69a' : driftScore > -0.15 ? '#787b86' : driftScore > -0.5 ? '#ef5350' : '#f23645';

  return {
    ema1hTrend, macdVsZero, macdVsSignal, histogramRising, divergence, atr,
    driftLabel, driftPct, driftColor,
    macdParams: macdSettings, ema1hParams: { fast: 35, slow: 115 }, atrPeriod,
  };
}

export default function App() {
  // --- Navigation State ---
  const [currentView, setCurrentView] = useState<'menu' | 'simulator' | 'simulator-v2'>('menu');
  const [selectedSim, setSelectedSim] = useState<SimulationType>(SimulationType.GBM);
  const [activePreset, setActivePreset] = useState<MarketPreset>(MarketPreset.GENERIC);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- Market Data State ---
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [macdData, setMacdData] = useState<MacdData[]>([]);
  const [macd15Data, setMacd15Data] = useState<MacdData[]>([]); // 15-min MTF MACD
  const [emaData, setEmaData] = useState<{ time: number; value: number }[]>([]);
  const [hma2Data, setHma2Data] = useState<{ time: number; value: number }[]>([]);
  const [hmaData, setHmaData] = useState<{ time: number; value: number }[]>([]);
  const [hmaBandData, setHmaBandData] = useState<{ time: number; value: number }[]>([]);

  // --- Indicator Settings ---
  const [emaPeriod, setEmaPeriod] = useState(200);
  const [emaColor, setEmaColor] = useState('#facc15');
  const [isEma1Visible, setIsEma1Visible] = useState(false);
  const [hma2Period, setHma2Period] = useState(50);
  const [hma2Color, setHma2Color] = useState('#06b6d4');
  const [isHma2Visible, setIsHma2Visible] = useState(false);
  const [hmaPeriod, setHmaPeriod] = useState(100);
  const [hmaColor, setHmaColor] = useState('#a855f7');
  const [isHmaVisible, setIsHmaVisible] = useState(false);
  const [macdSettings, setMacdSettings] = useState({ fast: 35, slow: 115, signal: 18 });
  const [isMacdVisible, setIsMacdVisible] = useState(true);
  const [atrPeriod, setAtrPeriod] = useState(14);
  const [isAtrEnabled, setIsAtrEnabled] = useState(true);
  const [currentAtr, setCurrentAtr] = useState(0);
  const [macdDashboard, setMacdDashboard] = useState<MacdDashboardData>({
    ema1hTrend: 'BEARISH', macdVsZero: 0, macdVsSignal: 0, histogramRising: false,
    divergence: 'None', atr: 0, driftLabel: 'NEUTRAL', driftPct: 0, driftColor: '#facc15',
    macdParams: { fast: 35, slow: 115, signal: 18 }, ema1hParams: { fast: 35, slow: 115 }, atrPeriod: 14,
  });
  const [rsiDashboard, setRsiDashboard] = useState<RsiDashboardData>({
    rsi: 50, signal: 50, zone: 'NEUTRAL', length: 14, signalLength: 14,
  });

  // --- Trading State ---
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [priceLines, setPriceLines] = useState<number[]>([]);
  const [pnl, setPnl] = useState(0);
  const [slPoints, setSlPoints] = useState<number>(1);
  const [tpPoints, setTpPoints] = useState<number>(2);
  const [pipSize, setPipSize] = useState<number>(1);
  const [pipValue, setPipValue] = useState<number>(1);

  // --- Mode State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentSessionLabel, setCurrentSessionLabel] = useState('MANUAL');

  // --- GBM Config ---
  const [config, setConfig] = useState<MarketConfig>({
    volatility: 0.002,
    drift: 0.0001,
    tickSpeedMs: 200,
    startPrice: 1105,
  });

  // --- Per-Engine Params ---
  const [momentumParams, setMomentumParams] = useState({ volatility: 0.002, trendStrength: 0.6, drift: 0.0001 });
  const [ouParams, setOuParams] = useState({ meanLevel: 1105, reversionSpeed: 0.01, volatility: 1.5 });
  const [garchParams, setGarchParams] = useState({ omega: 0.000001, alpha: 0.10, beta: 0.85, drift: 0.0001 });
  const [currentGarchSigma, setCurrentGarchSigma] = useState(0.002);

  // --- Engine Refs ---
  const marketEngineRef = useRef<MarketEngine | null>(null);
  const momentumEngineRef = useRef<MomentumEngine | null>(null);
  const ouEngineRef = useRef<OUEngine | null>(null);
  const garchEngineRef = useRef<GARCHEngine | null>(null);
  const macdEngineRef = useRef<StreamingMACD | null>(null);
  const macd15EngineRef = useRef<StreamingMACD | null>(null); // 15-min MACD
  const emaEngineRef = useRef<StreamingEMA | null>(null);
  const hma2EngineRef = useRef<StreamingHMA | null>(null);
  const hmaEngineRef = useRef<StreamingHMA | null>(null);
  const atrEngineRef = useRef<StreamingATR | null>(null);
  const rsiEngineRef = useRef<StreamingUltimateRSI | null>(null);
  const isAtrEnabledRef = useRef(isAtrEnabled);
  const currentAtrRef = useRef(currentAtr);
  // 15-min MACD state tracking
  const macd15CountRef = useRef(0); // counts 1-min candles within current 15-min window
  const last15MacdRef = useRef({ macd: 0, signal: 0, histogram: 0 });
  const prev15MacdRef = useRef({ macd: 0, signal: 0, histogram: 0 });
  const mtfCandleBufferRef = useRef<Array<{open: number; high: number; low: number; close: number}>>([]);
  const macd15BarsRef = useRef<Array<{ close: number; macd: number }>>([]);  // closed 15m bars for divergence
  // 1H EMA state tracking
  const ema1h35Ref = useRef<StreamingEMA | null>(null);
  const ema1h115Ref = useRef<StreamingEMA | null>(null);
  const ema1hCountRef = useRef(0); // counts 1-min candles for 60-candle aggregation
  const ema1h35ValRef = useRef(0);
  const ema1h115ValRef = useRef(0);
  const hourCandleBufferRef = useRef<number[]>([]); // stores close prices for 60-candle agg

  // --- State Refs for hot path ---
  const configRef = useRef(config);
  const candlesRef = useRef(candles);
  const macdDataRef = useRef(macdData);
  const emaDataRef = useRef(emaData);
  const hma2DataRef = useRef(hma2Data);
  const hmaDataRef = useRef(hmaData);
  const slPointsRef = useRef(slPoints);
  const tpPointsRef = useRef(tpPoints);
  const pipSizeRef = useRef(pipSize);
  const pipValueRef = useRef(pipValue);
  const selectedSimRef = useRef(selectedSim);
  const activePresetRef = useRef(activePreset);
  const momentumParamsRef = useRef(momentumParams);
  const ouParamsRef = useRef(ouParams);
  const garchParamsRef = useRef(garchParams);

  // --- Market Context Refs ---
  const dayProfileRef = useRef<DayProfile>(DayProfile.CHOPPY);
  const baseBiasRef = useRef<number>(0);

  // Sync refs
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { macdDataRef.current = macdData; }, [macdData]);
  useEffect(() => { emaDataRef.current = emaData; }, [emaData]);
  useEffect(() => { hma2DataRef.current = hma2Data; }, [hma2Data]);
  useEffect(() => { hmaDataRef.current = hmaData; }, [hmaData]);
  useEffect(() => { slPointsRef.current = slPoints; }, [slPoints]);
  useEffect(() => { tpPointsRef.current = tpPoints; }, [tpPoints]);
  useEffect(() => { pipSizeRef.current = pipSize; }, [pipSize]);
  useEffect(() => { pipValueRef.current = pipValue; }, [pipValue]);
  useEffect(() => { selectedSimRef.current = selectedSim; }, [selectedSim]);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);
  useEffect(() => { momentumParamsRef.current = momentumParams; }, [momentumParams]);
  useEffect(() => { ouParamsRef.current = ouParams; }, [ouParams]);
  useEffect(() => { garchParamsRef.current = garchParams; }, [garchParams]);
  useEffect(() => { isAtrEnabledRef.current = isAtrEnabled; }, [isAtrEnabled]);
  useEffect(() => { currentAtrRef.current = currentAtr; }, [currentAtr]);

  // --- Indicator Recalculation Effect ---
  useEffect(() => {
    const currentCandles = candlesRef.current;
    if (currentCandles.length === 0) return;

    const newEmaEngine = new StreamingEMA(emaPeriod);
    const newHma2Engine = new StreamingHMA(hma2Period);
    const newHmaEngine = new StreamingHMA(hmaPeriod);
    const newMacdEngine = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);

    const newEmaData: { time: number; value: number }[] = [];
    const newHma2Data: { time: number; value: number }[] = [];
    const newHmaData: { time: number; value: number }[] = [];
    const newHmaBandData: { time: number; value: number }[] = [];
    const newMacdData: MacdData[] = [];

    currentCandles.forEach(c => {
      newEmaData.push({ time: c.time, value: newEmaEngine.next(c.close) });
      const hma2Val = newHma2Engine.next(c.close);
      newHma2Data.push({ time: c.time, value: hma2Val.value });
      const hmaVal = newHmaEngine.next(c.close);
      newHmaData.push({ time: c.time, value: hmaVal.value });
      newHmaBandData.push({ time: c.time, value: hmaVal.band });
      const macdVal = newMacdEngine.next(c.close);
      const prevHist = newMacdData.length > 0 ? newMacdData[newMacdData.length - 1].value : 0;
      newMacdData.push({ time: c.time, value: macdVal.histogram, color: getMacdColor(macdVal.histogram, prevHist), signal: macdVal.signal, macd: macdVal.macd });
    });

    if (newHmaData.length > 2) {
      const last = newHmaData[newHmaData.length - 1].value;
      const prev2 = newHmaData[newHmaData.length - 3].value;
      setHmaColor(last > prev2 ? '#00ff00' : '#ff0000');
    }

    // Replay 15-min MACD
    const new15MacdEngine = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);
    let count15 = 0;
    let last15 = { macd: 0, signal: 0, histogram: 0 };
    const new15MacdData: MacdData[] = [];
    const new15Bars: Array<{ close: number; macd: number }> = [];
    let buf15Close: number[] = [];
    currentCandles.forEach(c => {
      count15++;
      buf15Close.push(c.close);
      if (count15 >= 15) {
        count15 = 0;
        last15 = new15MacdEngine.next(c.close);
        new15Bars.push({ close: c.close, macd: last15.macd });
        buf15Close = [];
      }
      const prevHist = new15MacdData.length > 0 ? new15MacdData[new15MacdData.length - 1].value : 0;
      new15MacdData.push({ time: c.time, value: last15.histogram, color: getMacdColor(last15.histogram, prevHist), signal: last15.signal, macd: last15.macd });
    });
    macd15EngineRef.current = new15MacdEngine;
    macd15CountRef.current = count15;
    last15MacdRef.current = last15;
    macd15BarsRef.current = new15Bars;
    setMacd15Data(new15MacdData);

    setEmaData(newEmaData);
    setHma2Data(newHma2Data);
    setHmaData(newHmaData);
    setHmaBandData(newHmaBandData);
    setMacdData(newMacdData);
    emaEngineRef.current = newEmaEngine;
    hma2EngineRef.current = newHma2Engine;
    hmaEngineRef.current = newHmaEngine;
    macdEngineRef.current = newMacdEngine;

    const newAtrEngine = new StreamingATR(atrPeriod);
    let lastAtrVal = 0;
    currentCandles.forEach(c => {
      lastAtrVal = newAtrEngine.next(c.high, c.low, c.close);
    });
    setCurrentAtr(lastAtrVal);
    atrEngineRef.current = newAtrEngine;

    // Replay RSI
    const newRsiEngine = new StreamingUltimateRSI(14, 14);
    let lastRsi = { rsi: 50, signal: 50 };
    currentCandles.forEach(c => { lastRsi = newRsiEngine.next(c.close); });
    rsiEngineRef.current = newRsiEngine;
    setRsiDashboard({
      rsi: lastRsi.rsi, signal: lastRsi.signal,
      zone: lastRsi.rsi > 80 ? 'OVERBOUGHT' : lastRsi.rsi < 20 ? 'OVERSOLD' : 'NEUTRAL',
      length: 14, signalLength: 14,
    });

    // Replay 1H EMA
    const new1h35Engine = new StreamingEMA(35);
    const new1h115Engine = new StreamingEMA(115);
    let ema1h35Val = 0, ema1h115Val = 0;
    let hourCount = 0;
    currentCandles.forEach(c => {
      hourCount++;
      if (hourCount >= 60) {
        hourCount = 0;
        ema1h35Val = new1h35Engine.next(c.close);
        ema1h115Val = new1h115Engine.next(c.close);
      }
    });
    ema1h35Ref.current = new1h35Engine;
    ema1h115Ref.current = new1h115Engine;
    ema1hCountRef.current = hourCount;
    ema1h35ValRef.current = ema1h35Val;
    ema1h115ValRef.current = ema1h115Val;
    hourCandleBufferRef.current = [];

    // Compute dashboard
    setMacdDashboard(computeMacdDashboard(
      last15, { macd: 0, signal: 0, histogram: 0 },
      ema1h35Val, ema1h115Val,
      lastAtrVal, new15Bars, macdSettings, atrPeriod,
    ));
  }, [emaPeriod, hma2Period, hmaPeriod, macdSettings, atrPeriod]);

  // --- Helpers ---
  const getSpainTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
  };

  const getMadridTimeDecimal = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: 'numeric', hour12: false });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    return hour + (minute / 60);
  };

  const calculateSessionParameters = (timestamp: number) => {
    const timeVal = getMadridTimeDecimal(timestamp);
    const profile = dayProfileRef.current;
    const biasMagnitude = Math.abs(baseBiasRef.current);
    const isForex = activePresetRef.current === MarketPreset.EURUSD;
    // EUR/USD vol is ~1/5th of generic index vol in relative terms
    const volScale = isForex ? 0.15 : 1;
    let label = 'ASIA SESSION';
    let vol = 0.0003 * volScale;
    let d = 0;
    const driftNoise = isForex ? 0.00001 : 0.0001;
    const getMorningDrift = () => {
      if (profile === DayProfile.TREND_UP || profile === DayProfile.REVERSAL_DOWN) return biasMagnitude;
      if (profile === DayProfile.TREND_DOWN || profile === DayProfile.REVERSAL_UP) return -biasMagnitude;
      return (Math.random() - 0.5) * driftNoise;
    };
    const getAfternoonDrift = () => {
      if (profile === DayProfile.TREND_UP || profile === DayProfile.REVERSAL_UP) return biasMagnitude * 1.2;
      if (profile === DayProfile.TREND_DOWN || profile === DayProfile.REVERSAL_DOWN) return -biasMagnitude * 1.2;
      return (Math.random() - 0.5) * driftNoise;
    };
    if (timeVal >= 8 && timeVal < 9) { label = '🇩🇪 FRANKFURT OPEN'; vol = 0.0015 * volScale; d = getMorningDrift() * 0.5; }
    else if (timeVal >= 9 && timeVal < 11.5) { label = '🇬🇧 LONDON SESSION'; vol = 0.0035 * volScale; d = getMorningDrift() * 1.5; }
    else if (timeVal >= 11.5 && timeVal < 13.5) { label = '🍽️ LUNCH LULL'; vol = 0.0010 * volScale; d = 0; }
    else if (timeVal >= 13.5 && timeVal < 14.5) { label = '🇺🇸 PRE-NY'; vol = 0.0020 * volScale; d = getAfternoonDrift() * 0.5; }
    else if (timeVal >= 14.5 && timeVal < 15.5) { label = '📊 US MACRO DATA'; vol = 0.0060 * volScale; d = (Math.random() > 0.5 ? 1 : -1) * biasMagnitude * 2.0; }
    else if (timeVal >= 15.5 && timeVal < 17) { label = '⚡ LDN/NY OVERLAP'; vol = 0.0050 * volScale; d = getAfternoonDrift() * 1.8; }
    else if (timeVal >= 17 && timeVal < 17.5) { label = '🇬🇧 LONDON FIX'; vol = 0.0040 * volScale; d = getAfternoonDrift() * 1.2; }
    else if (timeVal >= 17.5 && timeVal < 22) { label = '🇺🇸 NY AFTERNOON'; vol = 0.0015 * volScale; d = getAfternoonDrift() * 0.5; }
    else { label = 'ASIA / ROLLOVER'; vol = 0.0002 * volScale; d = 0; }
    return { vol, drift: d, label };
  };

  const resetSimulation = (simType: SimulationType = selectedSimRef.current, preset: MarketPreset = activePreset) => {
    const p = MARKET_PRESETS[preset];
    const start = new Date();
    start.setHours(7, 55, 0, 0);
    const startTs = Math.floor(start.getTime() / 1000);
    const startPrice = p.startPrice;

    // Apply preset to all config/params
    setConfig({ volatility: p.volatility, drift: p.drift, tickSpeedMs: config.tickSpeedMs, startPrice });
    setSlPoints(p.slPoints);
    setTpPoints(p.tpPoints);
    setPipSize(p.pipSize);
    setPipValue(p.pipValue);
    setMomentumParams({ volatility: p.momentumVolatility, trendStrength: p.momentumTrendStrength, drift: p.momentumDrift });
    setOuParams({ meanLevel: p.ouMeanLevel, reversionSpeed: p.ouReversionSpeed, volatility: p.ouVolatility });
    setGarchParams({ omega: p.garchOmega, alpha: p.garchAlpha, beta: p.garchBeta, drift: p.garchDrift });

    // Instantiate the correct engine
    marketEngineRef.current = new MarketEngine(startPrice, startTs);
    momentumEngineRef.current = new MomentumEngine(startPrice, startTs);
    ouEngineRef.current = new OUEngine(startPrice, startTs);
    garchEngineRef.current = new GARCHEngine(startPrice, startTs, p.volatility);

    macdEngineRef.current = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);
    macd15EngineRef.current = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);
    macd15CountRef.current = 0;
    last15MacdRef.current = { macd: 0, signal: 0, histogram: 0 };
    prev15MacdRef.current = { macd: 0, signal: 0, histogram: 0 };
    mtfCandleBufferRef.current = [];
    macd15BarsRef.current = [];
    ema1h35Ref.current = new StreamingEMA(35);
    ema1h115Ref.current = new StreamingEMA(115);
    ema1hCountRef.current = 0;
    ema1h35ValRef.current = 0;
    ema1h115ValRef.current = 0;
    hourCandleBufferRef.current = [];
    emaEngineRef.current = new StreamingEMA(emaPeriod);
    hma2EngineRef.current = new StreamingHMA(hma2Period);
    hmaEngineRef.current = new StreamingHMA(hmaPeriod);
    atrEngineRef.current = new StreamingATR(atrPeriod);
    rsiEngineRef.current = new StreamingUltimateRSI(14, 14);
    setCurrentAtr(0);

    const rand = Math.random();
    let profile = DayProfile.CHOPPY;
    let bias = preset === MarketPreset.EURUSD ? 0.00002 : 0.00010;
    if (rand < 0.3) { profile = Math.random() > 0.5 ? DayProfile.TREND_UP : DayProfile.TREND_DOWN; bias *= 2; }
    else if (rand < 0.6) { profile = Math.random() > 0.5 ? DayProfile.REVERSAL_UP : DayProfile.REVERSAL_DOWN; bias *= 1.5; }
    else { profile = DayProfile.CHOPPY; bias *= 0.5; }

    dayProfileRef.current = profile;
    baseBiasRef.current = bias;

    setCandles([]);
    setMacdData([]);
    setEmaData([]);
    setHma2Data([]);
    setHmaData([]);
    setHmaBandData([]);
    setTrades([]);
    setPriceLines([]);
    setMacd15Data([]);
    setIsPlaying(false);
    setCurrentSessionLabel('RESET');
    setCurrentGarchSigma(p.volatility);

    if (simType === SimulationType.GBM) {
      setConfig(prev => ({ ...prev, volatility: p.volatility, drift: p.drift }));
    }
  };

  // --- Snapshot Logic ---
  const captureSnapshot = (
    cEmaData: { value: number }[],
    cHma2Data: { value: number }[],
    cHmaData: { value: number }[],
    cMacdData: MacdData[]
  ): TradeSnapshot | undefined => {
    if (cEmaData.length === 0 || cMacdData.length === 0) return undefined;
    const currentEma = cEmaData[cEmaData.length - 1].value;
    const currentHma2 = cHma2Data.length > 0 ? cHma2Data[cHma2Data.length - 1].value : 0;
    const currentHma = cHmaData.length > 0 ? cHmaData[cHmaData.length - 1].value : 0;
    const currentMacd = cMacdData[cMacdData.length - 1];
    const prevHist = cMacdData.length > 1 ? cMacdData[cMacdData.length - 2].value : 0;
    const currHist = currentMacd.value;
    let trend: TradeSnapshot['macd']['trend'] = 'Neutral';
    if (currHist >= 0) { trend = currHist >= prevHist ? 'Positive Growing' : 'Positive Shrinking'; }
    else { trend = currHist < prevHist ? 'Negative Growing' : 'Negative Shrinking'; }
    return { ema: currentEma, hma2: currentHma2, hma: currentHma, macd: { macd: currentMacd.macd, signal: currentMacd.signal, histogram: currHist, trend } };
  };

  // --- Initialization ---
  useEffect(() => {
    resetSimulation(SimulationType.GBM);
  }, []);

  // --- Simulation Loop ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isPlaying) {
      intervalId = setInterval(() => {
        if (!macdEngineRef.current || !emaEngineRef.current || !hma2EngineRef.current || !hmaEngineRef.current) return;

        const sim = selectedSimRef.current;
        let newCandle: CandleData;

        if (sim === SimulationType.GBM) {
          if (!marketEngineRef.current) return;
          let currentVol = configRef.current.volatility;
          let currentDrift = configRef.current.drift;
          if (isAutoMode) {
            const simTime = marketEngineRef.current.getCurrentTime() + CANDLE_TIME_STEP;
            const { vol, drift, label } = calculateSessionParameters(simTime);
            currentVol = vol;
            currentDrift = drift + (Math.random() - 0.5) * (vol * 0.05);
            if (label !== currentSessionLabel) setCurrentSessionLabel(label);
            if (!isBlindMode) setConfig(prev => ({ ...prev, volatility: vol, drift }));
          } else {
            if (currentSessionLabel !== 'MANUAL') setCurrentSessionLabel('MANUAL');
          }
          newCandle = marketEngineRef.current.nextTick(currentDrift, currentVol, CANDLE_TIME_STEP);

        } else if (sim === SimulationType.MOMENTUM) {
          if (!momentumEngineRef.current) return;
          const p = momentumParamsRef.current;
          newCandle = momentumEngineRef.current.nextTick(p.drift, p.volatility, p.trendStrength, CANDLE_TIME_STEP);
          if (currentSessionLabel !== 'MANUAL') setCurrentSessionLabel('MANUAL');

        } else if (sim === SimulationType.OU) {
          if (!ouEngineRef.current) return;
          const p = ouParamsRef.current;
          newCandle = ouEngineRef.current.nextTick(p.meanLevel, p.reversionSpeed, p.volatility, CANDLE_TIME_STEP);
          if (currentSessionLabel !== 'MANUAL') setCurrentSessionLabel('MANUAL');

        } else { // GARCH
          if (!garchEngineRef.current) return;
          const p = garchParamsRef.current;
          newCandle = garchEngineRef.current.nextTick(p.drift, p.omega, p.alpha, p.beta, CANDLE_TIME_STEP);
          setCurrentGarchSigma(garchEngineRef.current.getCurrentSigma());
          if (currentSessionLabel !== 'MANUAL') setCurrentSessionLabel('MANUAL');
        }

        // 15-min MTF MACD: proper OHLC aggregation over 15 1-min candles
        let current15Macd = last15MacdRef.current;
        mtfCandleBufferRef.current.push({ open: newCandle.open, high: newCandle.high, low: newCandle.low, close: newCandle.close });
        if (mtfCandleBufferRef.current.length === 15 && macd15EngineRef.current) {
          const buf = mtfCandleBufferRef.current;
          const agg = {
            open: buf[0].open,
            high: Math.max(...buf.map(c => c.high)),
            low: Math.min(...buf.map(c => c.low)),
            close: buf[14].close,
          };
          prev15MacdRef.current = { ...last15MacdRef.current };
          current15Macd = macd15EngineRef.current.next(agg.close);
          last15MacdRef.current = current15Macd;
          mtfCandleBufferRef.current = [];
          // Track closed 15m bar for divergence (close + MACD)
          const bars15 = macd15BarsRef.current;
          bars15.push({ close: agg.close, macd: current15Macd.macd });
          if (bars15.length > 300) bars15.shift();
        }

        // 1H EMA aggregation (60 1-min candles)
        hourCandleBufferRef.current.push(newCandle.close);
        if (hourCandleBufferRef.current.length >= 60) {
          const hourClose = hourCandleBufferRef.current[hourCandleBufferRef.current.length - 1];
          if (ema1h35Ref.current) ema1h35ValRef.current = ema1h35Ref.current.next(hourClose);
          if (ema1h115Ref.current) ema1h115ValRef.current = ema1h115Ref.current.next(hourClose);
          hourCandleBufferRef.current = [];
        }

        const newMacd = macdEngineRef.current.next(newCandle.close);
        const newEmaVal = emaEngineRef.current.next(newCandle.close);
        const newHma2Val = hma2EngineRef.current.next(newCandle.close);
        const newHmaVal = hmaEngineRef.current.next(newCandle.close);
        if (atrEngineRef.current) {
          const newAtrVal = atrEngineRef.current.next(newCandle.high, newCandle.low, newCandle.close);
          setCurrentAtr(newAtrVal);
          currentAtrRef.current = newAtrVal;
        }
        if (rsiEngineRef.current) {
          const rsiVal = rsiEngineRef.current.next(newCandle.close);
          setRsiDashboard({
            rsi: rsiVal.rsi, signal: rsiVal.signal,
            zone: rsiVal.rsi > 80 ? 'OVERBOUGHT' : rsiVal.rsi < 20 ? 'OVERSOLD' : 'NEUTRAL',
            length: 14, signalLength: 14,
          });
        }

        setCandles(prev => {
          const next = [...prev, newCandle];
          if (next.length > 2000) next.shift();
          return next;
        });
        setMacdData(prev => {
          const prevHist = prev.length > 0 ? prev[prev.length - 1].value : 0;
          const next = [...prev, { time: newCandle.time, value: newMacd.histogram, color: getMacdColor(newMacd.histogram, prevHist), signal: newMacd.signal, macd: newMacd.macd }];
          if (next.length > 2000) next.shift();
          return next;
        });
        setEmaData(prev => {
          const next = [...prev, { time: newCandle.time, value: newEmaVal }];
          if (next.length > 2000) next.shift();
          return next;
        });
        setHma2Data(prev => {
          const next = [...prev, { time: newCandle.time, value: newHma2Val.value }];
          if (next.length > 2000) next.shift();
          return next;
        });
        setHmaData(prev => {
          const next = [...prev, { time: newCandle.time, value: newHmaVal.value }];
          if (next.length > 2000) next.shift();
          if (next.length > 2) {
            const current = next[next.length - 1].value;
            const prev2 = next[next.length - 3].value;
            setHmaColor(current > prev2 ? '#00ff00' : '#ff0000');
          }
          return next;
        });
        setHmaBandData(prev => {
          const next = [...prev, { time: newCandle.time, value: newHmaVal.band }];
          if (next.length > 2000) next.shift();
          return next;
        });
        setMacd15Data(prev => {
          const prevHist = prev.length > 0 ? prev[prev.length - 1].value : 0;
          const next = [...prev, { time: newCandle.time, value: current15Macd.histogram, color: getMacdColor(current15Macd.histogram, prevHist), signal: current15Macd.signal, macd: current15Macd.macd }];
          if (next.length > 2000) next.shift();
          // Compute dashboard with latest data
          setMacdDashboard(computeMacdDashboard(
            last15MacdRef.current,
            prev15MacdRef.current,
            ema1h35ValRef.current,
            ema1h115ValRef.current,
            currentAtrRef.current,
            macd15BarsRef.current,
            macdSettings,
            atrPeriod,
          ));
          return next;
        });
      }, config.tickSpeedMs);
    }

    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isPlaying, isAutoMode, currentSessionLabel, isBlindMode, config.tickSpeedMs]);

  // --- Automated TP/SL Monitor ---
  useEffect(() => {
    if (candles.length === 0) return;
    const lastCandle = candles[candles.length - 1];
    const spread = MARKET_PRESETS[activePresetRef.current].spread ?? 0;
    setTrades(prevTrades => {
      let hasUpdates = false;
      const updated = prevTrades.map(trade => {
        // --- Fill pending limit orders ---
        if (trade.status === 'PENDING') {
          const filled = trade.type === TradeType.LONG
            ? lastCandle.low <= trade.entryPrice
            : lastCandle.high >= trade.entryPrice;
          if (filled) {
            hasUpdates = true;
            return { ...trade, status: 'OPEN', entryTime: lastCandle.time } as Trade;
          }
          return trade;
        }
        if (trade.status !== 'OPEN') return trade;
        let closePrice: number | undefined;
        let reason: 'TP' | 'SL' | undefined;
        if (trade.type === TradeType.LONG) {
          if (trade.stopLoss && lastCandle.low <= trade.stopLoss) { closePrice = Math.min(lastCandle.low, trade.stopLoss) - spread / 2; reason = 'SL'; }
          else if (trade.takeProfit && lastCandle.high >= trade.takeProfit) { closePrice = trade.takeProfit - spread / 2; reason = 'TP'; }
        } else {
          if (trade.stopLoss && lastCandle.high >= trade.stopLoss) { closePrice = Math.max(lastCandle.high, trade.stopLoss) + spread / 2; reason = 'SL'; }
          else if (trade.takeProfit && lastCandle.low <= trade.takeProfit) { closePrice = trade.takeProfit + spread / 2; reason = 'TP'; }
        }
        if (closePrice !== undefined) {
          hasUpdates = true;
          const diff = trade.type === TradeType.LONG ? closePrice - trade.entryPrice : trade.entryPrice - closePrice;
          const pnl = (diff / (pipSizeRef.current || 0.0001)) * pipValueRef.current;
          return { ...trade, status: 'CLOSED', closePrice, closeTime: lastCandle.time, pnl, exitReason: reason } as Trade;
        }
        return trade;
      });
      return hasUpdates ? updated : prevTrades;
    });
  }, [candles]);

  // --- Real-time PnL ---
  useEffect(() => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;
    const ps = pipSizeRef.current;
    const pv = pipValueRef.current;
    const openPnl = trades.filter(t => t.status === 'OPEN').reduce((acc, trade) => {
      const diff = trade.type === TradeType.LONG ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
      return acc + (diff / ps) * pv;
    }, 0);
    const closedPnl = trades.filter(t => t.status === 'CLOSED').reduce((acc, trade) => acc + (trade.pnl || 0), 0);
    setPnl(openPnl + closedPnl);
  }, [candles, trades]);

  // --- Hotkeys ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
      if (currentView !== 'simulator' && currentView !== 'simulator-v2') return;

      const key = e.key.toLowerCase();
      if (key === ' ') { e.preventDefault(); setIsPlaying(prev => !prev); return; }
      if (key === 'd') { setIsDrawingMode(prev => !prev); return; }
      if (key === 'z') { setPriceLines(prev => prev.length === 0 ? prev : prev.slice(1)); return; }
      // Speed shortcuts: 1=20ms, 2=60ms, 3=120ms, 4=200ms, 5=300ms, 6=420ms, 7=560ms, 8=720ms, 9=900ms, 0=1000ms
      const speedMap: Record<string, number> = { '1': 20, '2': 60, '3': 120, '4': 200, '5': 300, '6': 420, '7': 560, '8': 720, '9': 900, '0': 1000 };
      if (speedMap[key]) { setConfig(prev => ({ ...prev, tickSpeedMs: speedMap[key] })); return; }
      if (key === 'x') {
        if (candlesRef.current.length === 0) return;
        setTrades(prev => {
          const lastOpenIdx = prev.findLastIndex(t => t.status === 'OPEN');
          if (lastOpenIdx === -1) return prev;
          const currentCandles = candlesRef.current;
          if (currentCandles.length === 0) return prev;
          const midPrice = currentCandles[currentCandles.length - 1].close;
          const t = prev[lastOpenIdx];
          const xSpread = MARKET_PRESETS[activePresetRef.current].spread ?? 0;
          const closePrice = t.type === TradeType.LONG ? midPrice - xSpread / 2 : midPrice + xSpread / 2;
          const diff = t.type === TradeType.LONG ? closePrice - t.entryPrice : t.entryPrice - closePrice;
          const profit = (diff / (pipSizeRef.current || 0.0001)) * pipValueRef.current;
          const updated = [...prev];
          updated[lastOpenIdx] = { ...t, status: 'CLOSED', closePrice, closeTime: currentCandles[currentCandles.length - 1].time, pnl: profit, exitReason: 'MANUAL' };
          return updated;
        });
        return;
      }
      if (key === 'q' || key === 'w') {
        // Limit orders: Q = buy limit, W = sell limit — at the last price line
        setPriceLines(prevLines => {
          if (prevLines.length === 0) return prevLines;
          const limitPrice = prevLines[prevLines.length - 1];
          const currentCandles = candlesRef.current;
          if (currentCandles.length === 0) return prevLines;
          const lastCandle = currentCandles[currentCandles.length - 1];
          const sl = slPointsRef.current;
          const tp = tpPointsRef.current;
          const type = key === 'q' ? TradeType.LONG : TradeType.SHORT;
          const stopLossPrice = sl > 0 ? (type === TradeType.LONG ? limitPrice - sl : limitPrice + sl) : undefined;
          const takeProfitPrice = tp > 0 ? (type === TradeType.LONG ? limitPrice + tp : limitPrice - tp) : undefined;
          const snapshot = captureSnapshot(emaDataRef.current, hma2DataRef.current, hmaDataRef.current, macdDataRef.current);
          const newTrade: Trade = { id: Math.random().toString(36).substr(2, 9), type, entryPrice: limitPrice, entryTime: lastCandle.time, status: 'PENDING', stopLoss: stopLossPrice, takeProfit: takeProfitPrice, exitReason: 'MANUAL', snapshot };
          setTrades(prev => [newTrade, ...prev]);
          return prevLines.slice(0, -1);
        });
        return;
      }
      if (key === 'c') {
        setTrades(prev => prev.map(t => t.status === 'OPEN' ? { ...t, stopLoss: t.entryPrice } : t));
        return;
      }
      if (key !== 'a' && key !== 's') return;

      const currentCandles = candlesRef.current;
      if (currentCandles.length === 0) return;
      const lastCandle = currentCandles[currentCandles.length - 1];
      const currentPrice = lastCandle.close;
      const sl = slPointsRef.current;
      const tp = tpPointsRef.current;
      const type = key === 'a' ? TradeType.LONG : TradeType.SHORT;
      const spread = MARKET_PRESETS[activePresetRef.current].spread ?? 0;
      const entryPrice = type === TradeType.LONG ? currentPrice + spread / 2 : currentPrice - spread / 2;
      const atrValHotkey = isAtrEnabledRef.current && currentAtrRef.current > 0 ? currentAtrRef.current : 0;
      const effectiveSlHotkey = atrValHotkey > 0 ? atrValHotkey * 3 : sl;
      const effectiveTpHotkey = atrValHotkey > 0 ? atrValHotkey * 6 : tp;
      const stopLossPrice = effectiveSlHotkey > 0 ? (type === TradeType.LONG ? entryPrice - effectiveSlHotkey : entryPrice + effectiveSlHotkey) : undefined;
      const takeProfitPrice = effectiveTpHotkey > 0 ? (type === TradeType.LONG ? entryPrice + effectiveTpHotkey : entryPrice - effectiveTpHotkey) : undefined;
      const snapshot = captureSnapshot(emaDataRef.current, hma2DataRef.current, hmaDataRef.current, macdDataRef.current);
      const newTrade: Trade = { id: Math.random().toString(36).substr(2, 9), type, entryPrice, entryTime: lastCandle.time, status: 'OPEN', stopLoss: stopLossPrice, takeProfit: takeProfitPrice, exitReason: 'MANUAL', snapshot };
      setTrades(prev => [newTrade, ...prev]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  // --- Navigation Handlers ---
  const handleSelectSim = (simType: SimulationType, preset?: MarketPreset, v2?: boolean) => {
    const resolvedPreset = preset || MarketPreset.GENERIC;
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedSim(simType);
      selectedSimRef.current = simType;
      setActivePreset(resolvedPreset);
      setCurrentView(v2 ? 'simulator-v2' : 'simulator');
      resetSimulation(simType, resolvedPreset);
      setIsTransitioning(false);
    }, 300);
  };

  const handleReturnToMenu = () => {
    setIsPlaying(false);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView('menu');
      setIsTransitioning(false);
    }, 300);
  };

  // --- Trade Handlers ---
  const handleTrade = (type: TradeType) => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;
    const spread = MARKET_PRESETS[activePreset].spread ?? 0;
    const entryPrice = type === TradeType.LONG ? currentPrice + spread / 2 : currentPrice - spread / 2;
    const atrVal = isAtrEnabledRef.current && currentAtrRef.current > 0 ? currentAtrRef.current : 0;
    const effectiveSl = atrVal > 0 ? atrVal * 3 : slPoints;
    const effectiveTp = atrVal > 0 ? atrVal * 6 : tpPoints;
    const stopLossPrice = effectiveSl > 0 ? (type === TradeType.LONG ? entryPrice - effectiveSl : entryPrice + effectiveSl) : undefined;
    const takeProfitPrice = effectiveTp > 0 ? (type === TradeType.LONG ? entryPrice + effectiveTp : entryPrice - effectiveTp) : undefined;
    const snapshot = captureSnapshot(emaData, hma2Data, hmaData, macdData);
    const newTrade: Trade = { id: Math.random().toString(36).substr(2, 9), type, entryPrice, entryTime: candles[candles.length - 1].time, status: 'OPEN', stopLoss: stopLossPrice, takeProfit: takeProfitPrice, exitReason: 'MANUAL', snapshot };
    setTrades(prev => [newTrade, ...prev]);
  };

  const closeTrade = (id: string) => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;
    const spread = MARKET_PRESETS[activePreset].spread ?? 0;
    setTrades(prev => prev.map(t => {
      if (t.id === id && t.status === 'PENDING') {
        return { ...t, status: 'CLOSED', closePrice: t.entryPrice, closeTime: candles[candles.length - 1].time, pnl: 0, exitReason: 'MANUAL' };
      }
      if (t.id === id && t.status === 'OPEN') {
        const closePrice = t.type === TradeType.LONG ? currentPrice - spread / 2 : currentPrice + spread / 2;
        const diff = t.type === TradeType.LONG ? closePrice - t.entryPrice : t.entryPrice - closePrice;
        const profit = (diff / (pipSizeRef.current || 0.0001)) * pipValueRef.current;
        return { ...t, status: 'CLOSED', closePrice, closeTime: candles[candles.length - 1].time, pnl: profit, exitReason: 'MANUAL' };
      }
      return t;
    }));
  };

  const downloadCSV = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'Type', 'Status', 'Entry Price', 'Exit Price', 'PnL', 'Entry Time', 'Exit Time', 'Exit Reason', 'EMA 1 (Entry)', 'HMA 2 (Entry)', 'HMA (Entry)', 'MACD Value', 'Signal Value', 'Histogram', 'Momentum Trend'].join(',');
    const rows = trades.map(trade => {
      const entryTimeStr = new Date(trade.entryTime * 1000).toISOString();
      const exitTimeStr = trade.closeTime ? new Date(trade.closeTime * 1000).toISOString() : '';
      const snap = trade.snapshot;
      const pp = MARKET_PRESETS[activePreset].pricePrecision;
      return [trade.id, trade.type, trade.status, trade.entryPrice.toFixed(pp), trade.closePrice ? trade.closePrice.toFixed(pp) : '', trade.pnl ? trade.pnl.toFixed(pp) : '', entryTimeStr, exitTimeStr, trade.exitReason || '', snap ? snap.ema.toFixed(pp) : '', snap ? snap.hma2.toFixed(pp) : '', snap ? snap.hma.toFixed(pp) : '', snap ? snap.macd.macd.toFixed(3) : '', snap ? snap.macd.signal.toFixed(3) : '', snap ? snap.macd.histogram.toFixed(3) : '', snap ? snap.macd.trend : ''].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `quantflow_trades_${Math.floor(Date.now() / 1000)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sessionStats = useMemo<SessionStats>(() => {
    const closed = trades.filter(t => t.status === 'CLOSED');
    if (closed.length === 0) {
      return { winRate: 0, avgRR: 0, profitFactor: 0, largestWin: 0, largestLoss: 0, maxConsecWins: 0, maxConsecLosses: 0, totalPips: 0, avgDurationMinutes: 0 };
    }

    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    const losses = closed.filter(t => (t.pnl ?? 0) <= 0);

    const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));

    const winRate = wins.length / closed.length;
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

    const avgWinPips = wins.length > 0
      ? wins.reduce((s, t) => s + Math.abs((t.closePrice ?? t.entryPrice) - t.entryPrice) / (pipSize || 0.0001), 0) / wins.length
      : 0;
    const avgLossPips = losses.length > 0
      ? losses.reduce((s, t) => s + Math.abs((t.closePrice ?? t.entryPrice) - t.entryPrice) / (pipSize || 0.0001), 0) / losses.length
      : 0;
    const avgRR = avgLossPips === 0 ? avgWinPips : avgWinPips / avgLossPips;

    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl ?? 0)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl ?? 0)) : 0;

    const totalPips = closed.reduce((s, t) => {
      const pipDiff = ((t.closePrice ?? t.entryPrice) - t.entryPrice) / (pipSize || 0.0001);
      return s + (t.type === 'LONG' ? pipDiff : -pipDiff);
    }, 0);

    // Consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0;
    closed.forEach(t => {
      if ((t.pnl ?? 0) > 0) { curW++; curL = 0; maxConsecWins = Math.max(maxConsecWins, curW); }
      else { curL++; curW = 0; maxConsecLosses = Math.max(maxConsecLosses, curL); }
    });

    // entryTime / closeTime are UNIX timestamps in seconds; dividing difference by 60 gives minutes
    const avgDurationMinutes = closed.reduce((s, t) => {
      return s + ((t.closeTime ?? t.entryTime) - t.entryTime) / 60;
    }, 0) / closed.length;

    return { winRate, avgRR, profitFactor, largestWin, largestLoss, maxConsecWins, maxConsecLosses, totalPips, avgDurationMinutes };
  }, [trades, pipSize]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : config.startPrice;
  const currentTimeDisplay = candles.length > 0 ? getSpainTime(candles[candles.length - 1].time) : '--:--';

  return (
    <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {currentView === 'menu' ? (
        <SimulationMenu onSelect={handleSelectSim} />
      ) : currentView === 'simulator-v2' ? (
        <SimulatorViewV2
          candles={candles}
          macdData={macdData}

          emaData={emaData}
          hma2Data={hma2Data}
          hmaData={hmaData}
          hmaBandData={hmaBandData}
          priceLines={priceLines}
          trades={trades}
          pnl={pnl}
          selectedTrade={selectedTrade}
          config={config}
          macdSettings={macdSettings}
          emaPeriod={emaPeriod}
          hma2Period={hma2Period}
          hmaPeriod={hmaPeriod}
          emaColor={emaColor}
          hma2Color={hma2Color}
          hmaColor={hmaColor}
          isEma1Visible={isEma1Visible}
          isHma2Visible={isHma2Visible}
          isHmaVisible={isHmaVisible}
          isMacdVisible={isMacdVisible}
          slPoints={slPoints}
          tpPoints={tpPoints}
          pipSize={pipSize}
          pipValue={pipValue}
          isPlaying={isPlaying}
          isAutoMode={isAutoMode}
          isBlindMode={isBlindMode}
          isDrawingMode={isDrawingMode}
          currentSessionLabel={currentSessionLabel}
          selectedSim={selectedSim}
          momentumParams={momentumParams}
          ouParams={ouParams}
          garchParams={garchParams}
          currentGarchSigma={currentGarchSigma}
          currentPrice={currentPrice}
          currentTimeDisplay={currentTimeDisplay}
          pricePrecision={MARKET_PRESETS[activePreset].pricePrecision}
          onReturnToMenu={handleReturnToMenu}
          onReset={() => resetSimulation(selectedSim, activePreset)}
          onTogglePlay={() => setIsPlaying(p => !p)}
          onToggleAutoMode={() => setIsAutoMode(p => !p)}
          onToggleBlindMode={() => setIsBlindMode(p => !p)}
          onToggleDrawingMode={() => setIsDrawingMode(p => !p)}
          onConfigChange={setConfig}
          onMacdSettingsChange={setMacdSettings}
          onEmaPeriodChange={setEmaPeriod}
          onHma2PeriodChange={setHma2Period}
          onHmaPeriodChange={setHmaPeriod}
          onEmaColorChange={setEmaColor}
          onHma2ColorChange={setHma2Color}
          onHmaColorChange={setHmaColor}
          onEma1VisibleChange={setIsEma1Visible}
          onHma2VisibleChange={setIsHma2Visible}
          onHmaVisibleChange={setIsHmaVisible}
          onMacdVisibleChange={setIsMacdVisible}
          onSlPointsChange={setSlPoints}
          onTpPointsChange={setTpPoints}
          onPipValueChange={setPipValue}
          onTrade={handleTrade}
          onCloseTrade={closeTrade}
          onSelectTrade={setSelectedTrade}
          onChartClick={(price) => { setPriceLines(prev => [...prev, price]); setIsDrawingMode(false); }}
          onRemoveLine={(index) => setPriceLines(prev => prev.filter((_, i) => i !== index))}
          onDownloadCSV={downloadCSV}
          onMomentumParamsChange={setMomentumParams}
          onOuParamsChange={setOuParams}
          onGarchParamsChange={setGarchParams}
          currentAtr={currentAtr}
          atrPeriod={atrPeriod}
          isAtrEnabled={isAtrEnabled}
          onAtrPeriodChange={setAtrPeriod}
          onAtrEnabledChange={setIsAtrEnabled}
          sessionStats={sessionStats}
          macdDashboard={macdDashboard}
          rsiDashboard={rsiDashboard}
        />
      ) : (
        <SimulatorView
          candles={candles}
          macdData={macdData}

          emaData={emaData}
          hma2Data={hma2Data}
          hmaData={hmaData}
          hmaBandData={hmaBandData}
          priceLines={priceLines}
          trades={trades}
          pnl={pnl}
          selectedTrade={selectedTrade}
          config={config}
          macdSettings={macdSettings}
          emaPeriod={emaPeriod}
          hma2Period={hma2Period}
          hmaPeriod={hmaPeriod}
          emaColor={emaColor}
          hma2Color={hma2Color}
          hmaColor={hmaColor}
          isEma1Visible={isEma1Visible}
          isHma2Visible={isHma2Visible}
          isHmaVisible={isHmaVisible}
          isMacdVisible={isMacdVisible}
          slPoints={slPoints}
          tpPoints={tpPoints}
          pipSize={pipSize}
          pipValue={pipValue}
          isPlaying={isPlaying}
          isAutoMode={isAutoMode}
          isBlindMode={isBlindMode}
          isDrawingMode={isDrawingMode}
          currentSessionLabel={currentSessionLabel}
          selectedSim={selectedSim}
          momentumParams={momentumParams}
          ouParams={ouParams}
          garchParams={garchParams}
          currentGarchSigma={currentGarchSigma}
          currentPrice={currentPrice}
          currentTimeDisplay={currentTimeDisplay}
          pricePrecision={MARKET_PRESETS[activePreset].pricePrecision}
          onReturnToMenu={handleReturnToMenu}
          onReset={() => resetSimulation(selectedSim, activePreset)}
          onTogglePlay={() => setIsPlaying(p => !p)}
          onToggleAutoMode={() => setIsAutoMode(p => !p)}
          onToggleBlindMode={() => setIsBlindMode(p => !p)}
          onToggleDrawingMode={() => setIsDrawingMode(p => !p)}
          onConfigChange={setConfig}
          onMacdSettingsChange={setMacdSettings}
          onEmaPeriodChange={setEmaPeriod}
          onHma2PeriodChange={setHma2Period}
          onHmaPeriodChange={setHmaPeriod}
          onEmaColorChange={setEmaColor}
          onHma2ColorChange={setHma2Color}
          onHmaColorChange={setHmaColor}
          onEma1VisibleChange={setIsEma1Visible}
          onHma2VisibleChange={setIsHma2Visible}
          onHmaVisibleChange={setIsHmaVisible}
          onMacdVisibleChange={setIsMacdVisible}
          onSlPointsChange={setSlPoints}
          onTpPointsChange={setTpPoints}
          onPipValueChange={setPipValue}
          onTrade={handleTrade}
          onCloseTrade={closeTrade}
          onSelectTrade={setSelectedTrade}
          onChartClick={(price) => { setPriceLines(prev => [...prev, price]); setIsDrawingMode(false); }}
          onRemoveLine={(index) => setPriceLines(prev => prev.filter((_, i) => i !== index))}
          onDownloadCSV={downloadCSV}
          onMomentumParamsChange={setMomentumParams}
          onOuParamsChange={setOuParams}
          onGarchParamsChange={setGarchParams}
          currentAtr={currentAtr}
          atrPeriod={atrPeriod}
          isAtrEnabled={isAtrEnabled}
          onAtrPeriodChange={setAtrPeriod}
          onAtrEnabledChange={setIsAtrEnabled}
          sessionStats={sessionStats}
          macdDashboard={macdDashboard}
          rsiDashboard={rsiDashboard}
        />
      )}
    </div>
  );
}
