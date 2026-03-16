import React, { useState, useEffect, useRef } from 'react';
import { MarketEngine } from './services/marketEngine';
import { StreamingMACD, StreamingEMA, StreamingHMA } from './services/indicators';
import { FinancialChart } from './components/FinancialChart';
import { TradeDetailsModal } from './components/TradeDetailsModal';
import { CandleData, MacdData, Trade, TradeType, MarketConfig, TradeSnapshot } from './types';

// Icons
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
const ClipboardListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14h.01"></path><path d="M9 10h.01"></path><path d="M9 18h.01"></path><path d="M13 14h4"></path><path d="M13 10h4"></path><path d="M13 18h4"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;

const CANDLE_TIME_STEP = 60; // Fixed to 1 minute candles for the simulation

// Day Types for Market Narrative
enum DayProfile {
  TREND_UP = 'TREND_UP',       // Strong Up all day
  TREND_DOWN = 'TREND_DOWN',   // Strong Down all day
  REVERSAL_UP = 'REVERSAL_UP', // Down morning, Up afternoon
  REVERSAL_DOWN = 'REVERSAL_DOWN', // Up morning, Down afternoon
  CHOPPY = 'CHOPPY'            // Range bound
}

// Helper for MACD Colors
const getMacdColor = (current: number, previous: number) => {
  if (current >= 0) {
    // Growing Positive (Strong Teal) vs Shrinking Positive (Lighter/Pale Teal)
    return current >= previous ? '#26a69a' : '#b2dfdb'; 
  } else {
    // Growing Negative (Strong Red) vs Shrinking Negative (Lighter/Pale Pink)
    // Note: Growing negative means becoming MORE negative (e.g. -5 < -2)
    return current < previous ? '#ef5350' : '#ffcdd2';
  }
};

export default function App() {
  // --- State ---
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [macdData, setMacdData] = useState<MacdData[]>([]);
  
  // EMA 1
  const [emaData, setEmaData] = useState<{time: number, value: number}[]>([]);
  const [emaPeriod, setEmaPeriod] = useState(200);
  const [emaColor, setEmaColor] = useState('#facc15'); // Default Yellow
  const [isEma1Visible, setIsEma1Visible] = useState(true);
  
  // HMA 2 (Was EMA 2)
  const [hma2Data, setHma2Data] = useState<{time: number, value: number}[]>([]);
  const [hma2Period, setHma2Period] = useState(50);
  const [hma2Color, setHma2Color] = useState('#06b6d4'); // Default Cyan
  const [isHma2Visible, setIsHma2Visible] = useState(true);

  // HMA 1 (Hull Suite)
  const [hmaData, setHmaData] = useState<{time: number, value: number}[]>([]);
  const [hmaBandData, setHmaBandData] = useState<{time: number, value: number}[]>([]);
  const [hmaPeriod, setHmaPeriod] = useState(100);
  const [hmaColor, setHmaColor] = useState('#a855f7'); // Default Violet
  const [isHmaVisible, setIsHmaVisible] = useState(true);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  
  // Modes
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentSessionLabel, setCurrentSessionLabel] = useState("MANUAL");
  
  const [config, setConfig] = useState<MarketConfig>({
    volatility: 0.002, 
    drift: 0.0001, 
    tickSpeedMs: 200, 
    startPrice: 1105, // Scaled (EUR/USD-like behavior)
  });

  // Analysis Settings
  // Default MACD Settings updated to 35, 115, 18
  const [macdSettings, setMacdSettings] = useState({ fast: 35, slow: 115, signal: 18 });
  const [isMacdVisible, setIsMacdVisible] = useState(true);
  
  const [priceLines, setPriceLines] = useState<number[]>([]);
  const [pnl, setPnl] = useState(0);

  // Execution Settings
  const [slPoints, setSlPoints] = useState<number>(1); // 1 Point
  const [tpPoints, setTpPoints] = useState<number>(2); // 2 Points

  // --- Refs for Simulation Engine ---
  const marketEngineRef = useRef<MarketEngine | null>(null);
  const macdEngineRef = useRef<StreamingMACD | null>(null);
  const emaEngineRef = useRef<StreamingEMA | null>(null);
  const hma2EngineRef = useRef<StreamingHMA | null>(null); // New HMA 2 Engine
  const hmaEngineRef = useRef<StreamingHMA | null>(null); // HMA 1 Engine
  
  // State Refs for loop access
  const configRef = useRef(config);
  const candlesRef = useRef(candles); 
  const macdDataRef = useRef(macdData); // Needed for snapshot capture in hotkeys
  const emaDataRef = useRef(emaData);   // Needed for snapshot capture in hotkeys
  const hma2DataRef = useRef(hma2Data); // Needed for snapshot capture in hotkeys
  const hmaDataRef = useRef(hmaData);   // Needed for snapshot capture in hotkeys
  const slPointsRef = useRef(slPoints);
  const tpPointsRef = useRef(tpPoints);
  
  // Market Context Refs
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

  // --- Indicator Recalculation Effect ---
  useEffect(() => {
      const currentCandles = candlesRef.current;
      if (currentCandles.length === 0) return;

      // 1. Instantiate new engines with updated settings
      const newEmaEngine = new StreamingEMA(emaPeriod);
      const newHma2Engine = new StreamingHMA(hma2Period);
      const newHmaEngine = new StreamingHMA(hmaPeriod);
      const newMacdEngine = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);

      // 2. Replay history
      const newEmaData: {time: number, value: number}[] = [];
      const newHma2Data: {time: number, value: number}[] = [];
      const newHmaData: {time: number, value: number}[] = [];
      const newHmaBandData: {time: number, value: number}[] = [];
      const newMacdData: MacdData[] = [];

      currentCandles.forEach(c => {
          const emaVal = newEmaEngine.next(c.close);
          newEmaData.push({ time: c.time, value: emaVal });
          
          const hma2Val = newHma2Engine.next(c.close);
          newHma2Data.push({ time: c.time, value: hma2Val.value }); // Use .value as StreamingHMA returns {value, band}

          const hmaVal = newHmaEngine.next(c.close);
          newHmaData.push({ time: c.time, value: hmaVal.value });
          newHmaBandData.push({ time: c.time, value: hmaVal.band });

          const macdVal = newMacdEngine.next(c.close);
          const prevHist = newMacdData.length > 0 ? newMacdData[newMacdData.length - 1].value : 0;
          
          newMacdData.push({
              time: c.time,
              value: macdVal.histogram,
              color: getMacdColor(macdVal.histogram, prevHist),
              signal: macdVal.signal,
              macd: macdVal.macd
          });
      });

      // Update Color for HMA 1 (Hull Suite) based on last 2 points
      if (newHmaData.length > 2) {
          const last = newHmaData[newHmaData.length - 1].value;
          const prev2 = newHmaData[newHmaData.length - 3].value;
          setHmaColor(last > prev2 ? '#00ff00' : '#ff0000');
      }

      // 3. Update State with recalculated data
      setEmaData(newEmaData);
      setHma2Data(newHma2Data);
      setHmaData(newHmaData);
      setHmaBandData(newHmaBandData);
      setMacdData(newMacdData);

      // 4. Update Refs so the next tick continues from this correct state
      emaEngineRef.current = newEmaEngine;
      hma2EngineRef.current = newHma2Engine;
      hmaEngineRef.current = newHmaEngine;
      macdEngineRef.current = newMacdEngine;

  }, [emaPeriod, hma2Period, hmaPeriod, macdSettings]); 

  // --- Helpers ---
  const getSpainTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
  };

  const getMadridTimeDecimal = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    return hour + (minute / 60);
  };

  // --- MARKET PROFILE: EUR/USD DEFAULT ---
  const calculateSessionParameters = (timestamp: number) => {
    const timeVal = getMadridTimeDecimal(timestamp);
    const profile = dayProfileRef.current;
    const biasMagnitude = Math.abs(baseBiasRef.current); 

    let label = "ASIA SESSION";
    let vol = 0.0003; // Low vol Asia
    let d = 0;

    const getMorningDrift = () => {
        if (profile === DayProfile.TREND_UP || profile === DayProfile.REVERSAL_DOWN) return biasMagnitude;
        if (profile === DayProfile.TREND_DOWN || profile === DayProfile.REVERSAL_UP) return -biasMagnitude;
        return (Math.random() - 0.5) * 0.0001; 
    };

    const getAfternoonDrift = () => {
        if (profile === DayProfile.TREND_UP || profile === DayProfile.REVERSAL_UP) return biasMagnitude * 1.2;
        if (profile === DayProfile.TREND_DOWN || profile === DayProfile.REVERSAL_DOWN) return -biasMagnitude * 1.2;
        return (Math.random() - 0.5) * 0.0001; 
    };

    // --- EUR/USD TRADING SCHEDULE (MADRID TIME) ---
    
    // 08:00 - 09:00: Frankfurt Open / Pre-London
    if (timeVal >= 8 && timeVal < 9) {
        label = "🇩🇪 FRANKFURT OPEN";
        vol = 0.0015; 
        d = getMorningDrift() * 0.5;
    }
    // 09:00 - 11:30: London Open / Core Session
    else if (timeVal >= 9 && timeVal < 11.5) {
        label = "🇬🇧 LONDON SESSION";
        vol = 0.0035; 
        d = getMorningDrift() * 1.5; 
    }
    // 11:30 - 13:30: Lunch Lull (Ranges common)
    else if (timeVal >= 11.5 && timeVal < 13.5) {
        label = "🍽️ LUNCH LULL";
        vol = 0.0010;
        d = 0; // Mean reversion / choppy
    }
    // 13:30 - 14:30: Pre-NY (Positioning)
    else if (timeVal >= 13.5 && timeVal < 14.5) {
        label = "🇺🇸 PRE-NY";
        vol = 0.0020;
        d = getAfternoonDrift() * 0.5;
    }
    // 14:30 - 15:30: US Macro Data (High Impact for EUR/USD)
    else if (timeVal >= 14.5 && timeVal < 15.5) {
        label = "📊 US MACRO DATA";
        vol = 0.0060; // Spikes
        d = (Math.random() > 0.5 ? 1 : -1) * biasMagnitude * 2.0; 
    }
    // 15:30 - 17:00: London/NY Overlap (Max Liquidity)
    else if (timeVal >= 15.5 && timeVal < 17) {
        label = "⚡ LDN/NY OVERLAP";
        vol = 0.0050; 
        d = getAfternoonDrift() * 1.8; 
    }
    // 17:00 - 17:30: London Fix (Reversals/Acceleration)
    else if (timeVal >= 17 && timeVal < 17.5) {
        label = "🇬🇧 LONDON FIX";
        vol = 0.0040;
        d = getAfternoonDrift() * 1.2;
    }
    // 17:30 - 22:00: NY Afternoon
    else if (timeVal >= 17.5 && timeVal < 22) {
        label = "🇺🇸 NY AFTERNOON";
        vol = 0.0015;
        d = getAfternoonDrift() * 0.5;
    }
    // 22:00+: Asia/Closed
    else {
        label = "ASIA / ROLLOVER";
        vol = 0.0002;
        d = 0;
    }

    return { vol, drift: d, label };
  };

  const resetSimulation = () => {
    const start = new Date();
    start.setHours(7, 55, 0, 0); 
    const startTs = Math.floor(start.getTime() / 1000);

    marketEngineRef.current = new MarketEngine(config.startPrice, startTs);
    macdEngineRef.current = new StreamingMACD(macdSettings.fast, macdSettings.slow, macdSettings.signal);
    emaEngineRef.current = new StreamingEMA(emaPeriod);
    hma2EngineRef.current = new StreamingHMA(hma2Period);
    hmaEngineRef.current = new StreamingHMA(hmaPeriod);
    
    const rand = Math.random();
    let profile = DayProfile.CHOPPY;
    let bias = 0.00010; 

    if (rand < 0.3) {
        profile = Math.random() > 0.5 ? DayProfile.TREND_UP : DayProfile.TREND_DOWN;
        bias = 0.00020; 
    } else if (rand < 0.6) {
        profile = Math.random() > 0.5 ? DayProfile.REVERSAL_UP : DayProfile.REVERSAL_DOWN;
        bias = 0.00015;
    } else {
        profile = DayProfile.CHOPPY;
        bias = 0.00005;
    }
    
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
    setIsPlaying(false);
    setCurrentSessionLabel("RESET");
    setConfig(prev => ({ ...prev, volatility: 0.0015, drift: 0.0000 }));
  };

  // --- Snapshot Logic ---
  const captureSnapshot = (
      cEmaData: {value: number}[],
      cHma2Data: {value: number}[],
      cHmaData: {value: number}[],
      cMacdData: MacdData[]
  ): TradeSnapshot | undefined => {
      if (cEmaData.length === 0 || cMacdData.length === 0) return undefined;

      const currentEma = cEmaData[cEmaData.length - 1].value;
      const currentHma2 = cHma2Data.length > 0 ? cHma2Data[cHma2Data.length - 1].value : 0;
      const currentHma = cHmaData.length > 0 ? cHmaData[cHmaData.length - 1].value : 0;
      const currentMacd = cMacdData[cMacdData.length - 1];
      // Get previous MACD histogram to determine trend, default to 0 if not available
      const prevHist = cMacdData.length > 1 ? cMacdData[cMacdData.length - 2].value : 0;
      const currHist = currentMacd.value;

      let trend: TradeSnapshot['macd']['trend'] = 'Neutral';

      if (currHist >= 0) {
          trend = currHist >= prevHist ? 'Positive Growing' : 'Positive Shrinking';
      } else {
          // Note: -5 < -2 (Growing Negative means moving further away from 0)
          trend = currHist < prevHist ? 'Negative Growing' : 'Negative Shrinking';
      }

      return {
          ema: currentEma,
          hma2: currentHma2,
          hma: currentHma,
          macd: {
              macd: currentMacd.macd,
              signal: currentMacd.signal,
              histogram: currHist,
              trend: trend
          }
      };
  };

  // --- Initialization ---
  useEffect(() => {
    resetSimulation();
  }, []); 

  // --- Simulation Loop ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isPlaying) {
      intervalId = setInterval(() => {
        if (!marketEngineRef.current || !macdEngineRef.current || !emaEngineRef.current || !hma2EngineRef.current || !hmaEngineRef.current) return;

        let currentVol = configRef.current.volatility;
        let currentDrift = configRef.current.drift;

        // Handle Auto Mode Logic
        if (isAutoMode) {
            const simTime = marketEngineRef.current.getCurrentTime() + CANDLE_TIME_STEP; 
            const { vol, drift, label } = calculateSessionParameters(simTime);
            
            currentVol = vol;
            currentDrift = drift;
            currentDrift += (Math.random() - 0.5) * (vol * 0.05);

            if (label !== currentSessionLabel) setCurrentSessionLabel(label);
            
            if (!isBlindMode) {
                setConfig(prev => ({ ...prev, volatility: vol, drift: drift }));
            }
        } else {
            if (currentSessionLabel !== "MANUAL") setCurrentSessionLabel("MANUAL");
        }

        const newCandle = marketEngineRef.current.nextTick(currentDrift, currentVol, CANDLE_TIME_STEP);
        const newMacd = macdEngineRef.current.next(newCandle.close);
        const newEmaVal = emaEngineRef.current.next(newCandle.close);
        const newHma2Val = hma2EngineRef.current.next(newCandle.close);
        const newHmaVal = hmaEngineRef.current.next(newCandle.close);

        setCandles(prev => {
            const next = [...prev, newCandle];
            if (next.length > 300) next.shift(); 
            return next;
        });

        setMacdData(prev => {
            const prevHist = prev.length > 0 ? prev[prev.length - 1].value : 0;
            const next = [...prev, {
                time: newCandle.time,
                value: newMacd.histogram,
                color: getMacdColor(newMacd.histogram, prevHist),
                signal: newMacd.signal,
                macd: newMacd.macd
            }];
            if (next.length > 300) next.shift();
            return next;
        });

        setEmaData(prev => {
            const next = [...prev, { time: newCandle.time, value: newEmaVal }];
            if (next.length > 300) next.shift();
            return next;
        });

        setHma2Data(prev => {
            const next = [...prev, { time: newCandle.time, value: newHma2Val.value }];
            if (next.length > 300) next.shift();
            return next;
        });

        setHmaData(prev => {
            const next = [...prev, { time: newCandle.time, value: newHmaVal.value }];
            if (next.length > 300) next.shift();
            
            // Check trend color logic for HMA 1 (Hull Suite)
            // Need at least 2 points to compare HMA[0] vs HMA[2]. 
            // In live loop, we look at the just added value vs value 2 ticks ago.
            // Using prev array is safer for history, but for simplicity we can use local calculation if needed.
            // Alternatively, we update color state based on this new value vs last known.
            return next;
        });

        setHmaBandData(prev => {
            const next = [...prev, { time: newCandle.time, value: newHmaVal.band }];
            if (next.length > 300) next.shift();
            return next;
        });

        // Dynamic Hull Suite Color Update
        setHmaData(prevHma => {
            if (prevHma.length > 2) {
                const current = prevHma[prevHma.length - 1].value;
                const prev2 = prevHma[prevHma.length - 3].value;
                setHmaColor(current > prev2 ? '#00ff00' : '#ff0000');
            }
            return prevHma;
        });

      }, config.tickSpeedMs); 
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, isAutoMode, currentSessionLabel, isBlindMode, config.tickSpeedMs]); 

  // --- Automated TP/SL Monitor ---
  useEffect(() => {
    if (candles.length === 0) return;
    const lastCandle = candles[candles.length - 1];

    setTrades(prevTrades => {
        let hasUpdates = false;
        const updated = prevTrades.map(trade => {
            if (trade.status !== 'OPEN') return trade;

            let closePrice: number | undefined;
            let reason: 'TP' | 'SL' | undefined;

            if (trade.type === TradeType.LONG) {
                if (trade.stopLoss && lastCandle.low <= trade.stopLoss) {
                    closePrice = trade.stopLoss; 
                    reason = 'SL';
                } else if (trade.takeProfit && lastCandle.high >= trade.takeProfit) {
                    closePrice = trade.takeProfit;
                    reason = 'TP';
                }
            } else { // SHORT
                if (trade.stopLoss && lastCandle.high >= trade.stopLoss) {
                    closePrice = trade.stopLoss;
                    reason = 'SL';
                } else if (trade.takeProfit && lastCandle.low <= trade.takeProfit) {
                    closePrice = trade.takeProfit;
                    reason = 'TP';
                }
            }

            if (closePrice !== undefined) {
                hasUpdates = true;
                const pnl = trade.type === TradeType.LONG 
                    ? closePrice - trade.entryPrice 
                    : trade.entryPrice - closePrice;
                
                return {
                    ...trade,
                    status: 'CLOSED',
                    closePrice,
                    closeTime: lastCandle.time,
                    pnl,
                    exitReason: reason
                } as Trade;
            }
            return trade;
        });

        return hasUpdates ? updated : prevTrades;
    });

  }, [candles]);

  // --- Real-time PnL Calculation ---
  useEffect(() => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;

    const openPnl = trades
        .filter(t => t.status === 'OPEN')
        .reduce((acc, trade) => {
            const diff = trade.type === TradeType.LONG 
                ? currentPrice - trade.entryPrice 
                : trade.entryPrice - currentPrice;
            return acc + diff;
        }, 0);
    
    const closedPnl = trades
        .filter(t => t.status === 'CLOSED')
        .reduce((acc, trade) => acc + (trade.pnl || 0), 0);

    setPnl(openPnl + closedPnl);
  }, [candles, trades]);

  // --- Hotkeys Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      
      if (key === ' ') {
          e.preventDefault();
          setIsPlaying(prev => !prev);
          return;
      }

      if (key === 'd') {
          setIsDrawingMode(prev => !prev);
          return;
      }
      
      if (key === 'z') {
        // Removes the oldest line (FIFO)
        setPriceLines(prev => {
            if (prev.length === 0) return prev;
            return prev.slice(1);
        });
        return;
      }

      if (key !== 'a' && key !== 's') return;

      const currentCandles = candlesRef.current;
      if (currentCandles.length === 0) return;
      
      const lastCandle = currentCandles[currentCandles.length - 1];
      const currentPrice = lastCandle.close;
      const sl = slPointsRef.current;
      const tp = tpPointsRef.current;

      let type = TradeType.LONG;
      if (key === 's') type = TradeType.SHORT;

      const stopLossPrice = sl > 0 
            ? (type === TradeType.LONG ? currentPrice - sl : currentPrice + sl)
            : undefined;

      const takeProfitPrice = tp > 0 
            ? (type === TradeType.LONG ? currentPrice + tp : currentPrice - tp)
            : undefined;

      const snapshot = captureSnapshot(emaDataRef.current, hma2DataRef.current, hmaDataRef.current, macdDataRef.current);

      const newTrade: Trade = {
            id: Math.random().toString(36).substr(2, 9),
            type: type,
            entryPrice: currentPrice,
            entryTime: lastCandle.time,
            status: 'OPEN',
            stopLoss: stopLossPrice,
            takeProfit: takeProfitPrice,
            exitReason: 'MANUAL',
            snapshot: snapshot
      };
      
      setTrades(prev => [newTrade, ...prev]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); 

  // --- Handlers ---
  const handleTrade = (type: TradeType) => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;
    
    const stopLossPrice = slPoints > 0 
        ? (type === TradeType.LONG ? currentPrice - slPoints : currentPrice + slPoints)
        : undefined;

    const takeProfitPrice = tpPoints > 0 
        ? (type === TradeType.LONG ? currentPrice + tpPoints : currentPrice - tpPoints)
        : undefined;

    const snapshot = captureSnapshot(emaData, hma2Data, hmaData, macdData);

    const newTrade: Trade = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        entryPrice: currentPrice,
        entryTime: candles[candles.length - 1].time,
        status: 'OPEN',
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        exitReason: 'MANUAL',
        snapshot: snapshot
    };
    setTrades(prev => [newTrade, ...prev]);
  };

  const closeTrade = (id: string) => {
    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;

    setTrades(prev => prev.map(t => {
        if (t.id === id && t.status === 'OPEN') {
            const profit = t.type === TradeType.LONG 
                ? currentPrice - t.entryPrice 
                : t.entryPrice - currentPrice;
            return {
                ...t,
                status: 'CLOSED',
                closePrice: currentPrice,
                closeTime: candles[candles.length - 1].time,
                pnl: profit,
                exitReason: 'MANUAL'
            };
        }
        return t;
    }));
  };

  const handleChartClick = (price: number) => {
      setPriceLines(prev => [...prev, price]);
      setIsDrawingMode(false);
  };
  
  const removeLine = (index: number) => {
      setPriceLines(prev => prev.filter((_, i) => i !== index));
  };
  
  const toggleDrawingMode = () => {
      setIsDrawingMode(!isDrawingMode);
  };

  const downloadCSV = () => {
    if (trades.length === 0) return;

    const headers = [
      "ID", "Type", "Status", "Entry Price", "Exit Price", "PnL", 
      "Entry Time", "Exit Time", "Exit Reason", 
      "EMA 1 (Entry)", "HMA 2 (Entry)", "HMA (Entry)", "MACD Value", "Signal Value", "Histogram", "Momentum Trend"
    ].join(",");

    const rows = trades.map(trade => {
      const entryTimeStr = new Date(trade.entryTime * 1000).toISOString();
      const exitTimeStr = trade.closeTime ? new Date(trade.closeTime * 1000).toISOString() : "";
      
      const snap = trade.snapshot;
      const ema = snap ? snap.ema.toFixed(2) : "";
      const hma2 = snap ? snap.hma2.toFixed(2) : "";
      const hma = snap ? snap.hma.toFixed(2) : "";
      const macd = snap ? snap.macd.macd.toFixed(3) : "";
      const signal = snap ? snap.macd.signal.toFixed(3) : "";
      const hist = snap ? snap.macd.histogram.toFixed(3) : "";
      const trend = snap ? snap.macd.trend : "";

      return [
        trade.id,
        trade.type,
        trade.status,
        trade.entryPrice.toFixed(2),
        trade.closePrice ? trade.closePrice.toFixed(2) : "",
        trade.pnl ? trade.pnl.toFixed(2) : "",
        entryTimeStr,
        exitTimeStr,
        trade.exitReason || "",
        ema,
        hma2,
        hma,
        macd,
        signal,
        hist,
        trend
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `quantflow_trades_${Math.floor(Date.now() / 1000)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : config.startPrice;
  const currentTimeDisplay = candles.length > 0 ? getSpainTime(candles[candles.length - 1].time) : "--:--";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      <TradeDetailsModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />

      {/* Header */}
      <header className="h-14 border-b border-slate-700 bg-slate-800/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                <h1 className="font-bold text-lg tracking-tight text-white">Quant<span className="text-indigo-400">Flow</span> Sim</h1>
            </div>
            
            {/* Session Badge */}
            <div className={`px-3 py-1 rounded text-xs font-bold border ${isAutoMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                {isAutoMode ? currentSessionLabel : "MANUAL MODE"}
            </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Simulated Time (Madrid)</div>
                <div className="font-mono text-lg leading-none text-emerald-400">{currentTimeDisplay}</div>
            </div>
            <div className={`font-mono text-sm px-4 py-2 rounded-lg border ${pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                PNL: ${pnl.toFixed(2)}
            </div>
        </div>
      </header>

      <main className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-3.5rem)]">
        
        {/* Left Column: Controls & Trading */}
        <aside className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
            
            {/* Simulation Config */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <h2 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-wider flex justify-between items-center">
                    <span>Market Engine</span>
                    <button onClick={resetSimulation} className="text-slate-500 hover:text-white" title="Reset Simulation">
                        <RefreshIcon />
                    </button>
                </h2>
                
                <div className="space-y-4">
                    {/* Play/Pause */}
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${isPlaying ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'}`}
                        title="Spacebar to Toggle"
                    >
                        {isPlaying ? <><PauseIcon /> PAUSE FEED</> : <><PlayIcon /> START FEED</>}
                    </button>
                    
                    {/* Modes */}
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setIsAutoMode(!isAutoMode)}
                            className={`px-2 py-2 rounded text-xs font-semibold border transition-all ${isAutoMode ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                        >
                            Real Trading Day
                        </button>
                        <button 
                            onClick={() => setIsBlindMode(!isBlindMode)}
                            className={`px-2 py-2 rounded text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${isBlindMode ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                        >
                            {isBlindMode ? <EyeOffIcon /> : <EyeIcon />} Blind Mode
                        </button>
                    </div>

                    {/* Tick Speed Slider */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-slate-500 flex justify-between items-center">
                            <span>Update Speed (ms)</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="1"
                                    value={config.tickSpeedMs}
                                    onChange={(e) => setConfig({...config, tickSpeedMs: parseInt(e.target.value) || 100})}
                                    className="bg-transparent text-right text-slate-300 font-mono text-xs w-14 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0"
                                />
                                <span className="text-slate-500 font-mono text-xs">ms</span>
                            </div>
                        </label>
                        <input 
                            type="range" min="20" max="5000" step="20"
                            value={config.tickSpeedMs}
                            onChange={(e) => setConfig({...config, tickSpeedMs: parseInt(e.target.value)})}
                            className="w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Volatility */}
                    <div className={`space-y-1 pt-2 border-t border-slate-700/50 transition-opacity ${isAutoMode ? 'opacity-100' : 'opacity-100'}`}>
                        <label className="text-xs text-slate-500 flex justify-between items-center">
                            <span>Volatility (σ)</span>
                            {isBlindMode ? (
                                <span className="text-slate-600 select-none">****</span>
                            ) : (
                                <div className="flex items-center justify-end gap-1">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        disabled={isAutoMode}
                                        value={parseFloat((config.volatility * 100).toFixed(3))}
                                        onChange={(e) => setConfig({...config, volatility: (parseFloat(e.target.value) || 0) / 100})}
                                        className={`bg-transparent text-right text-indigo-400 font-mono text-xs w-12 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0 ${isAutoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="text-indigo-400 font-mono text-xs">%</span>
                                </div>
                            )}
                        </label>
                        <input 
                            type="range" min="0.0005" max="0.01" step="0.0001" 
                            value={config.volatility}
                            disabled={isAutoMode}
                            onChange={(e) => setConfig({...config, volatility: parseFloat(e.target.value)})}
                            className={`w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer ${isAutoMode ? 'cursor-default' : ''}`}
                        />
                    </div>

                    {/* Drift */}
                    <div className={`space-y-1 transition-opacity ${isAutoMode ? 'opacity-100' : 'opacity-100'}`}>
                        <label className="text-xs text-slate-500 flex justify-between items-center">
                            <span>Drift (μ)</span>
                            {isBlindMode ? (
                                <span className="text-slate-600 select-none">****</span>
                            ) : (
                                <input
                                    type="number"
                                    step="0.00001"
                                    disabled={isAutoMode}
                                    value={parseFloat(config.drift.toFixed(5))}
                                    onChange={(e) => setConfig({...config, drift: parseFloat(e.target.value) || 0})}
                                    className={`bg-transparent text-right ${config.drift > 0 ? 'text-emerald-400' : 'text-red-400'} font-mono text-xs w-20 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0 ${isAutoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                            )}
                        </label>
                        <input 
                            type="range" min="-0.002" max="0.002" step="0.0001" 
                            value={config.drift}
                            disabled={isAutoMode}
                            onChange={(e) => setConfig({...config, drift: parseFloat(e.target.value)})}
                            className={`w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer ${isAutoMode ? 'cursor-default' : ''}`}
                        />
                    </div>
                </div>
            </div>
            
            {/* Technical Tools */}
             <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <h2 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-wider">Analysis Tools</h2>
                
                {/* EMA 1 Control */}
                <div className="space-y-2 mb-4">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsEma1Visible(!isEma1Visible)} className="text-slate-500 hover:text-white transition-colors">
                                {isEma1Visible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <label className="text-xs text-slate-500">EMA 1 Period</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={emaColor} 
                                onChange={(e) => setEmaColor(e.target.value)}
                                className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent"
                                title="EMA Color"
                            />
                            <input
                                type="number"
                                min="1"
                                value={emaPeriod}
                                onChange={(e) => setEmaPeriod(parseInt(e.target.value) || 1)}
                                className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0"
                                style={{color: emaColor}}
                            />
                        </div>
                     </div>
                    <input 
                        type="range" min="5" max="200" step="5"
                        value={emaPeriod}
                        onChange={(e) => setEmaPeriod(parseInt(e.target.value))}
                        className="w-full accent-yellow-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                        style={{accentColor: emaColor}}
                    />
                </div>

                {/* HMA 2 Control (Replaced EMA 2) */}
                <div className="space-y-2 mb-4">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsHma2Visible(!isHma2Visible)} className="text-slate-500 hover:text-white transition-colors">
                                {isHma2Visible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <label className="text-xs text-slate-500">HMA 2 Period</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={hma2Color} 
                                onChange={(e) => setHma2Color(e.target.value)}
                                className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent"
                                title="HMA 2 Color"
                            />
                            <input
                                type="number"
                                min="1"
                                value={hma2Period}
                                onChange={(e) => setHma2Period(parseInt(e.target.value) || 1)}
                                className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0"
                                style={{color: hma2Color}}
                            />
                        </div>
                     </div>
                    <input 
                        type="range" min="5" max="200" step="5"
                        value={hma2Period}
                        onChange={(e) => setHma2Period(parseInt(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                        style={{accentColor: hma2Color}}
                    />
                </div>

                {/* HMA Control (Original Hull Suite) */}
                <div className="space-y-2 mb-4">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsHmaVisible(!isHmaVisible)} className="text-slate-500 hover:text-white transition-colors">
                                {isHmaVisible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <label className="text-xs text-slate-500">HMA Period</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={hmaColor} 
                                onChange={(e) => setHmaColor(e.target.value)}
                                className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent"
                                title="HMA Color"
                            />
                            <input
                                type="number"
                                min="1"
                                value={hmaPeriod}
                                onChange={(e) => setHmaPeriod(parseInt(e.target.value) || 1)}
                                className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0"
                                style={{color: hmaColor}}
                            />
                        </div>
                     </div>
                    <input 
                        type="range" min="5" max="300" step="5"
                        value={hmaPeriod}
                        onChange={(e) => setHmaPeriod(parseInt(e.target.value))}
                        className="w-full accent-violet-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                        style={{accentColor: hmaColor}}
                    />
                </div>

                {/* MACD Settings */}
                <div className="space-y-2 mb-4 border-t border-slate-700 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setIsMacdVisible(!isMacdVisible)} className="text-slate-500 hover:text-white transition-colors">
                            {isMacdVisible ? <EyeIcon /> : <EyeOffIcon />}
                        </button>
                        <label className="text-xs text-slate-500 block">MACD ({macdSettings.fast}, {macdSettings.slow}, {macdSettings.signal})</label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <span className="text-[10px] text-slate-500 block">Fast</span>
                            <input 
                                type="number" min="1" max="100"
                                value={macdSettings.fast}
                                onChange={(e) => setMacdSettings(s => ({...s, fast: Math.max(1, parseInt(e.target.value) || 12)}))}
                                className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 block">Slow</span>
                            <input 
                                type="number" min="1" max="200"
                                value={macdSettings.slow}
                                onChange={(e) => setMacdSettings(s => ({...s, slow: Math.max(1, parseInt(e.target.value) || 26)}))}
                                className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 block">Signal</span>
                            <input 
                                type="number" min="1" max="50"
                                value={macdSettings.signal}
                                onChange={(e) => setMacdSettings(s => ({...s, signal: Math.max(1, parseInt(e.target.value) || 9)}))}
                                className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200"
                            />
                        </div>
                    </div>
                </div>

                {/* Drawing Tools Buttons */}
                <div className="flex gap-2">
                    <button 
                        onClick={toggleDrawingMode}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 border rounded-lg text-xs transition-colors ${isDrawingMode ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                        title="Draw Support/Resistance Lines"
                    >
                        <PencilIcon /> {isDrawingMode ? 'ACTIVE' : 'DRAW'}
                    </button>
                </div>

                {/* Active Levels List */}
                {priceLines.length > 0 && (
                     <div className="mt-3 border-t border-slate-700 pt-3">
                        <div className="flex flex-wrap gap-2 mb-2">
                            {priceLines.map((price, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-[10px] bg-slate-700 px-2 py-1 rounded border border-slate-600">
                                    <span className="text-pink-400 font-mono">{price.toFixed(2)}</span>
                                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-white">×</button>
                                </div>
                            ))}
                        </div>
                        <div className="text-[9px] text-slate-600 italic text-right">
                            (Press 'Z' to remove oldest)
                        </div>
                     </div>
                )}
            </div>

            {/* Trading Panel */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex-1 flex flex-col min-h-[350px]">
                <h2 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-wider">Execution</h2>
                
                {/* TP/SL Inputs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Stop Loss (pts)</label>
                        <div className="relative">
                            <input 
                                type="number" min="0" step="0.1"
                                value={slPoints}
                                onChange={(e) => setSlPoints(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-900/50 text-sm px-2 py-1.5 rounded border border-red-900/50 focus:border-red-500 outline-none text-red-300"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-slate-600">pts</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Take Profit (pts)</label>
                        <div className="relative">
                            <input 
                                type="number" min="0" step="0.1"
                                value={tpPoints}
                                onChange={(e) => setTpPoints(parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-900/50 text-sm px-2 py-1.5 rounded border border-emerald-900/50 focus:border-emerald-500 outline-none text-emerald-300"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-slate-600">pts</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button 
                        onClick={() => handleTrade(TradeType.LONG)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-transform active:scale-95 text-sm flex flex-col items-center justify-center"
                    >
                        <span>BUY <span className="opacity-70 font-normal text-[10px]">(A)</span></span>
                        {(tpPoints > 0 || slPoints > 0) && (
                            <span className="text-[9px] font-normal opacity-70 mt-0.5">
                                {tpPoints > 0 && `TP:+${tpPoints}`} {slPoints > 0 && `SL:-${slPoints}`}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => handleTrade(TradeType.SHORT)}
                        className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-900/20 transition-transform active:scale-95 text-sm flex flex-col items-center justify-center"
                    >
                        <span>SELL <span className="opacity-70 font-normal text-[10px]">(S)</span></span>
                        {(tpPoints > 0 || slPoints > 0) && (
                            <span className="text-[9px] font-normal opacity-70 mt-0.5">
                                {tpPoints > 0 && `TP:-${tpPoints}`} {slPoints > 0 && `SL:+${slPoints}`}
                            </span>
                        )}
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto border-t border-slate-700 pt-2">
                    <h3 className="text-xs text-slate-500 mb-2 font-semibold flex justify-between items-center">
                        <span>Order Book / History</span>
                        <button 
                            onClick={downloadCSV}
                            className="text-slate-500 hover:text-white transition-colors p-1"
                            title="Download Trade History CSV"
                        >
                            <DownloadIcon />
                        </button>
                    </h3>
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="text-slate-500 font-mono text-[10px] uppercase">
                            <tr>
                                <th className="pb-2 font-normal">Side</th>
                                <th className="pb-2 font-normal">Entry</th>
                                <th className="pb-2 font-normal text-right">PnL</th>
                                <th className="pb-2 font-normal text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {trades.map(trade => {
                                const isClosed = trade.status === 'CLOSED';
                                const livePnl = isClosed 
                                    ? trade.pnl 
                                    : (trade.type === TradeType.LONG ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice);

                                return (
                                    <tr key={trade.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                                        <td className={`py-2 ${trade.type === TradeType.LONG ? 'text-emerald-400' : 'text-red-400'}`}>
                                            <div className="flex flex-col">
                                                <span>{trade.type.substring(0,1)}</span>
                                                {trade.stopLoss && <span className="text-[8px] text-slate-600">SL:{trade.stopLoss.toFixed(2)}</span>}
                                            </div>
                                        </td>
                                        <td className="py-2 text-slate-300 align-top">
                                            {trade.entryPrice.toFixed(2)}
                                            {trade.takeProfit && <div className="text-[8px] text-slate-600">TP:{trade.takeProfit.toFixed(2)}</div>}
                                        </td>
                                        <td className={`py-2 text-right font-bold align-top ${livePnl! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {livePnl!.toFixed(2)}
                                        </td>
                                        <td className="py-2 text-right align-top">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={() => setSelectedTrade(trade)}
                                                    className="text-slate-500 hover:text-white transition-colors p-1"
                                                    title="View Technical Details"
                                                >
                                                    <ClipboardListIcon />
                                                </button>

                                                {!isClosed && (
                                                    <button 
                                                        onClick={() => closeTrade(trade.id)}
                                                        className="text-[9px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded opacity-80 hover:opacity-100 transition-opacity ml-1"
                                                    >
                                                        X
                                                    </button>
                                                )}
                                                {isClosed && trade.exitReason && trade.exitReason !== 'MANUAL' && (
                                                     <span className={`ml-1 text-[8px] font-bold ${trade.exitReason === 'TP' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {trade.exitReason}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {trades.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-600 italic">No trades executed</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </aside>

        {/* Right Column: Chart */}
        <div className="lg:col-span-3 h-[500px] lg:h-auto flex flex-col relative">
            <FinancialChart 
                candles={candles} 
                macdData={macdData} 
                currentPrice={currentPrice}
                priceLines={priceLines}
                emaData={emaData}
                hma2Data={hma2Data}
                hmaData={hmaData}
                hmaBandData={hmaBandData}
                isDrawingMode={isDrawingMode}
                macdConfig={macdSettings}
                emaColor={emaColor}
                hma2Color={hma2Color}
                hmaColor={hmaColor}
                isEma1Visible={isEma1Visible}
                isHma2Visible={isHma2Visible}
                isHmaVisible={isHmaVisible}
                isMacdVisible={isMacdVisible}
                onChartClick={handleChartClick}
            />
            
            {/* Overlay Stats */}
            <div className="absolute bottom-6 left-6 flex gap-2 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Last Update</span>
                    <span className="text-slate-200">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Model</span>
                    <span className="text-indigo-400">GBM Stochastic</span>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}