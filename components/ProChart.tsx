import React, { useEffect, useRef, useState } from 'react';
import { CandleData, MacdData, Trade, Timeframe, TIMEFRAME_SECONDS } from '../types';
import { TimeframeChartData } from '../services/timeframeAggregator';
import { formatBerlinTime, formatBerlinDate } from '../services/daxEngine';

// TradingView-style chart for V3: one Lightweight Charts instance with native panes (price + volume + EMAs,
// timeframe MACD) and a second instance below with the always-on 4h MACD on its own 4h time axis.

interface ProChartProps {
  data: TimeframeChartData;       // selected timeframe
  macd4h: MacdData[];             // always-on 4h MACD
  timeframe: Timeframe;
  dataVersion: number;            // changes when series are rebuilt wholesale → full setData
  simTime: number;                // time of the latest 1m candle, for the bar-close countdown
  trades: Trade[];
  priceLines: number[];
  isDrawingMode: boolean;
  isEma1Visible: boolean;
  isHma2Visible: boolean;
  isHmaVisible: boolean;
  emaColor: string;
  hma2Color: string;
  hmaColor: string;
  emaPeriod: number;
  hma2Period: number;
  hmaPeriod: number;
  macdConfig: { fast: number; slow: number; signal: number };
  pricePrecision: number;
  pipSize: number;
  symbol: string;
  onChartClick: (price: number) => void;
}

const C = {
  bg: '#131722',
  grid: '#1e222d',
  text: '#b2b5be',
  textMuted: '#787b86',
  border: '#2a2e39',
  up: '#089981',
  down: '#f23645',
  macd: '#2962ff',
  signal: '#ff6d00',
  crosshair: '#758696',
};

// Bars an LWC series may hold beyond the data window before it is rebuilt (live bars append via update())
const PRUNE_SLACK = 100;
// Bars shown after a timeframe switch (all of them when there are fewer), like TradingView's default zoom
const DEFAULT_VISIBLE_BARS = 150;
const RIGHT_OFFSET = 8;

const showLatestBars = (chart: any, bars: number) => {
  chart?.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars - DEFAULT_VISIBLE_BARS), to: bars - 1 + RIGHT_OFFSET });
};

const fmt = (v: number, d: number) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtVol = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v));

const fmtCountdown = (s: number) => {
  if (s <= 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const indexAt = (candles: CandleData[], time: number) => {
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].time;
    if (t === time) return mid;
    if (t < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
};

const volumePoint = (c: CandleData) => ({
  time: c.time,
  value: c.volume ?? 0,
  color: c.close >= c.open ? 'rgba(8,153,129,0.45)' : 'rgba(242,54,69,0.45)',
});

const histPoint = (d: MacdData) => ({ time: d.time, value: d.value, color: d.color });

// Axis labels in Berlin time; LWC tick mark types 0–2 are year/month/day boundaries
const chartLocalization = {
  timeFormatter: (t: number) => formatBerlinTime(t, true),
};
const tickMarkFormatter = (t: number, type: number) => (type <= 2 ? formatBerlinDate(t) : formatBerlinTime(t));

export function ProChart(props: ProChartProps) {
  const {
    data, macd4h, timeframe, dataVersion, simTime, trades, priceLines, isDrawingMode,
    isEma1Visible, isHma2Visible, isHmaVisible, emaColor, hma2Color, hmaColor, emaPeriod, hma2Period, hmaPeriod,
    macdConfig, pricePrecision, pipSize, symbol, onChartClick,
  } = props;

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const htfContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const htfChartRef = useRef<any>(null);
  const s = useRef<Record<string, any>>({}); // series
  const watermarkRef = useRef<any>(null);
  const priceLineObjs = useRef<any[]>([]);
  const tradeLineObjs = useRef<Map<string, any>>(new Map());

  const lastTimeframe = useRef<Timeframe | null>(null);
  const lastVersion = useRef(dataVersion);
  const lastLength = useRef(0);
  const lastBarTime = useRef<number | null>(null);
  const seriesBars = useRef(0);
  const last4hLength = useRef(0);
  const last4hVersion = useRef(dataVersion);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hover4hTime, setHover4hTime] = useState<number | null>(null);

  // Latest values for chart event handlers registered once
  const drawingRef = useRef(isDrawingMode);
  drawingRef.current = isDrawingMode;
  const onChartClickRef = useRef(onChartClick);
  onChartClickRef.current = onChartClick;

  // ── Create charts ──────────────────────────────────────────────────────
  useEffect(() => {
    const LWC = (window as any).LightweightCharts;
    if (!LWC || !mainContainerRef.current || !htfContainerRef.current) return;
    const { createChart, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode, ColorType, LineStyle } = LWC;

    const base = {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontSize: 11,
        panes: { separatorColor: C.border, separatorHoverColor: 'rgba(41,98,255,0.25)', enableResize: true },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.crosshair, style: LineStyle.Dashed, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: C.crosshair, style: LineStyle.Dashed, labelBackgroundColor: '#2a2e39' },
      },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false, rightOffset: RIGHT_OFFSET, tickMarkFormatter },
      localization: chartLocalization,
    };

    const chart = createChart(mainContainerRef.current, { ...base, timeScale: { ...base.timeScale, barSpacing: 7 } });
    const priceFormat = { type: 'custom', minMove: Math.pow(10, -pricePrecision), formatter: (p: number) => fmt(p, pricePrecision) };

    s.current.candle = chart.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down, wickUpColor: C.up, wickDownColor: C.down, borderVisible: false, priceFormat,
    }, 0);
    s.current.volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false,
    }, 0);
    s.current.volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const line = (color: string, visible: boolean) => chart.addSeries(LineSeries, {
      color, lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible, priceFormat,
    }, 0);
    s.current.ema1 = line(emaColor, isEma1Visible);
    s.current.ema2 = line(hma2Color, isHma2Visible);
    s.current.ema3 = line(hmaColor, isHmaVisible);

    s.current.hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1);
    s.current.macd = chart.addSeries(LineSeries, { color: C.macd, lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false }, 1);
    s.current.signal = chart.addSeries(LineSeries, { color: C.signal, lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false }, 1);
    chart.panes()[1]?.setHeight(130);

    if (LWC.createTextWatermark) {
      watermarkRef.current = LWC.createTextWatermark(chart.panes()[0], {
        horzAlign: 'center', vertAlign: 'center',
        lines: [{ text: symbol, color: 'rgba(120,123,134,0.10)', fontSize: 64, fontStyle: 'bold' }],
      });
    }

    chart.subscribeCrosshairMove((param: any) => setHoverTime(param.time ?? null));
    chart.subscribeClick((param: any) => {
      if (!drawingRef.current || !param.point || (param.paneIndex ?? 0) !== 0) return;
      const price = s.current.candle.coordinateToPrice(param.point.y);
      if (price !== null) onChartClickRef.current(price);
    });
    // ── 4h MACD chart ──
    const htf = createChart(htfContainerRef.current, { ...base, timeScale: { ...base.timeScale, barSpacing: 6 } });
    s.current.hist4h = htf.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
    s.current.macd4h = htf.addSeries(LineSeries, { color: C.macd, lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false });
    s.current.signal4h = htf.addSeries(LineSeries, { color: C.signal, lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false });
    htf.subscribeCrosshairMove((param: any) => setHover4hTime(param.time ?? null));

    chartRef.current = chart;
    htfChartRef.current = htf;
    return () => {
      chart.remove();
      htf.remove();
      s.current = {};
      priceLineObjs.current = [];
      tradeLineObjs.current.clear();
      lastTimeframe.current = null;
      last4hLength.current = 0;
    };
  }, []);

  // ── Main data: incremental update() of the last bar, full setData() when the window changes ──
  useEffect(() => {
    const ss = s.current;
    if (!ss.candle) return;
    const { candles, emaData, hma2Data, hmaData, macdData } = data;
    const timeframeChanged = timeframe !== lastTimeframe.current;
    const full = candles.length === 0 || candles.length < lastLength.current || timeframeChanged
      || dataVersion !== lastVersion.current || seriesBars.current > candles.length + PRUNE_SLACK;

    if (full) {
      ss.candle.setData(candles);
      ss.volume.setData(candles.map(volumePoint));
      ss.ema1.setData(emaData);
      ss.ema2.setData(hma2Data);
      ss.ema3.setData(hmaData);
      ss.hist.setData(macdData.map(histPoint));
      ss.macd.setData(macdData.map(d => ({ time: d.time, value: d.macd })));
      ss.signal.setData(macdData.map(d => ({ time: d.time, value: d.signal })));
      seriesBars.current = candles.length;
      if (timeframeChanged) {
        showLatestBars(chartRef.current, candles.length);
        watermarkRef.current?.applyOptions({ lines: [{ text: `${symbol}, ${timeframe}`, color: 'rgba(120,123,134,0.10)', fontSize: 64, fontStyle: 'bold' }] });
      }
    } else {
      const last = candles[candles.length - 1];
      if (last.time !== lastBarTime.current) seriesBars.current++;
      ss.candle.update(last);
      ss.volume.update(volumePoint(last));
      ss.ema1.update(emaData[emaData.length - 1]);
      ss.ema2.update(hma2Data[hma2Data.length - 1]);
      ss.ema3.update(hmaData[hmaData.length - 1]);
      const m = macdData[macdData.length - 1];
      ss.hist.update(histPoint(m));
      ss.macd.update({ time: m.time, value: m.macd });
      ss.signal.update({ time: m.time, value: m.signal });
    }

    lastTimeframe.current = timeframe;
    lastVersion.current = dataVersion;
    lastLength.current = candles.length;
    lastBarTime.current = candles.length > 0 ? candles[candles.length - 1].time : null;
  }, [data, timeframe, dataVersion]);

  // ── 4h MACD data ──
  useEffect(() => {
    const ss = s.current;
    if (!ss.hist4h) return;
    if (macd4h.length === 0 || macd4h.length < last4hLength.current || last4hLength.current === 0 || dataVersion !== last4hVersion.current) {
      ss.hist4h.setData(macd4h.map(histPoint));
      ss.macd4h.setData(macd4h.map(d => ({ time: d.time, value: d.macd })));
      ss.signal4h.setData(macd4h.map(d => ({ time: d.time, value: d.signal })));
      if (last4hLength.current === 0) showLatestBars(htfChartRef.current, macd4h.length);
    } else {
      const m = macd4h[macd4h.length - 1];
      ss.hist4h.update(histPoint(m));
      ss.macd4h.update({ time: m.time, value: m.macd });
      ss.signal4h.update({ time: m.time, value: m.signal });
    }
    last4hLength.current = macd4h.length;
    last4hVersion.current = dataVersion;
  }, [macd4h, dataVersion]);

  // ── Indicator styling ──
  useEffect(() => {
    const ss = s.current;
    ss.ema1?.applyOptions({ color: emaColor, visible: isEma1Visible });
    ss.ema2?.applyOptions({ color: hma2Color, visible: isHma2Visible });
    ss.ema3?.applyOptions({ color: hmaColor, visible: isHmaVisible });
  }, [emaColor, hma2Color, hmaColor, isEma1Visible, isHma2Visible, isHmaVisible]);

  // ── Drawn levels ──
  useEffect(() => {
    const candle = s.current.candle;
    if (!candle) return;
    priceLineObjs.current.forEach(l => candle.removePriceLine(l));
    priceLineObjs.current = priceLines.map(price => candle.createPriceLine({
      price, color: '#f472b6', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: 'LEVEL',
    }));
  }, [priceLines]);

  // ── Entry / SL / TP lines of open trades (diffed, not rebuilt) ──
  useEffect(() => {
    const candle = s.current.candle;
    if (!candle) return;
    const wanted = new Map<string, { price: number; color: string; title: string; style: number }>();
    trades.filter(t => t.status === 'OPEN' || t.status === 'PENDING').forEach(t => {
      const pts = (p: number) => Math.round(Math.abs(t.entryPrice - p) / pipSize);
      wanted.set(`${t.id}-entry`, { price: t.entryPrice, color: t.status === 'PENDING' ? '#f59e0b' : '#d1d4dc', title: `${t.type}${t.status === 'PENDING' ? ' LIMIT' : ''}`, style: 0 });
      if (t.stopLoss !== undefined) wanted.set(`${t.id}-sl`, { price: t.stopLoss, color: C.down, title: `SL ${pts(t.stopLoss)} pts`, style: 2 });
      if (t.takeProfit !== undefined) wanted.set(`${t.id}-tp`, { price: t.takeProfit, color: C.up, title: `TP ${pts(t.takeProfit)} pts`, style: 2 });
    });
    tradeLineObjs.current.forEach((lineObj, key) => {
      const w = wanted.get(key);
      if (!w || lineObj.options().price !== w.price || lineObj.options().title !== w.title) {
        candle.removePriceLine(lineObj);
        tradeLineObjs.current.delete(key);
      }
    });
    wanted.forEach((w, key) => {
      if (tradeLineObjs.current.has(key)) return;
      tradeLineObjs.current.set(key, candle.createPriceLine({
        price: w.price, color: w.color, lineWidth: 1, lineStyle: w.style, axisLabelVisible: true, title: w.title,
      }));
    });
  }, [trades, pipSize]);

  // ── Legends (hovered bar, or the latest one) ──
  const { candles, emaData, hma2Data, hmaData, macdData } = data;
  let i = hoverTime !== null ? indexAt(candles, hoverTime) : -1;
  if (i < 0) i = candles.length - 1;
  const bar = candles[i];
  const prevClose = i > 0 ? candles[i - 1].close : bar?.open;
  const change = bar ? bar.close - prevClose : 0;
  const changePct = bar && prevClose ? (change / prevClose) * 100 : 0;
  const barColor = change >= 0 ? C.up : C.down;
  const macdBar = macdData[i];
  const isLive = i === candles.length - 1;
  const countdown = bar && isLive && timeframe !== '1m' ? fmtCountdown(bar.time + TIMEFRAME_SECONDS[timeframe] - (simTime + 60)) : '';

  let j = hover4hTime !== null ? macd4h.findIndex(d => d.time === hover4hTime) : -1;
  if (j < 0) j = macd4h.length - 1;
  const m4 = macd4h[j];

  // The chart re-renders every tick, so reading the pane size here follows separator drags and resizes
  const macdPaneTop = chartRef.current ? chartRef.current.paneSize(0).height + 1 : 0;
  const macdLabel = `MACD ${macdConfig.fast} ${macdConfig.slow} ${macdConfig.signal}`;
  const mv = (v: number | undefined) => (v === undefined ? '—' : fmt(v, 2));

  return (
    <div className="flex flex-col w-full h-full" style={{ background: C.bg }}>
      <div className="relative flex-1 min-h-0" style={{ cursor: isDrawingMode ? 'crosshair' : 'default' }}>
        <div ref={mainContainerRef} className="absolute inset-0" />

        {/* OHLC + indicator legend */}
        {bar && (
          <div className="absolute top-2 left-3 z-10 pointer-events-none font-mono text-[11px] leading-5 select-none">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[12px]" style={{ color: '#d1d4dc' }}>{symbol} · {timeframe} · SIM</span>
              <span style={{ color: C.textMuted }}>O</span><span style={{ color: barColor }}>{fmt(bar.open, pricePrecision)}</span>
              <span style={{ color: C.textMuted }}>H</span><span style={{ color: barColor }}>{fmt(bar.high, pricePrecision)}</span>
              <span style={{ color: C.textMuted }}>L</span><span style={{ color: barColor }}>{fmt(bar.low, pricePrecision)}</span>
              <span style={{ color: C.textMuted }}>C</span><span style={{ color: barColor }}>{fmt(bar.close, pricePrecision)}</span>
              <span style={{ color: barColor }}>{change >= 0 ? '+' : ''}{fmt(change, pricePrecision)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)</span>
              <span style={{ color: C.textMuted }}>Vol</span><span style={{ color: C.text }}>{fmtVol(bar.volume ?? 0)}</span>
              {countdown && <span className="px-1.5 rounded" style={{ background: '#2a2e39', color: C.text }}>closes in {countdown}</span>}
            </div>
            {[
              [isEma1Visible, emaColor, emaPeriod, emaData[i]?.value],
              [isHma2Visible, hma2Color, hma2Period, hma2Data[i]?.value],
              [isHmaVisible, hmaColor, hmaPeriod, hmaData[i]?.value],
            ].filter(([visible]) => visible).map(([, color, period, value]) => (
              <div key={String(period) + String(color)} className="flex gap-2">
                <span style={{ color: C.textMuted }}>EMA {period as number}</span>
                <span style={{ color: color as string }}>{value === undefined ? '—' : fmt(value as number, pricePrecision)}</span>
              </div>
            ))}
            <div style={{ color: C.textMuted }}>{formatBerlinTime(bar.time, true)} Berlin</div>
          </div>
        )}

        {/* Timeframe MACD legend, pinned to the top of pane 1 */}
        {macdPaneTop > 0 && (
          <div className="absolute left-3 z-10 pointer-events-none font-mono text-[11px] flex gap-2" style={{ top: macdPaneTop + 4 }}>
            <span style={{ color: C.text }}>{macdLabel} · {timeframe}</span>
            <span style={{ color: macdBar?.color ?? C.text }}>{mv(macdBar?.value)}</span>
            <span style={{ color: C.macd }}>{mv(macdBar?.macd)}</span>
            <span style={{ color: C.signal }}>{mv(macdBar?.signal)}</span>
          </div>
        )}

        {isDrawingMode && (
          <div className="absolute top-2 right-20 z-10 text-[11px] font-bold px-3 py-1 rounded animate-pulse pointer-events-none" style={{ background: '#f59e0b33', color: '#f59e0b', border: '1px solid #f59e0b55' }}>
            DRAW — click the price pane to place a level
          </div>
        )}
      </div>

      {/* Always-on 4h MACD */}
      <div className="relative shrink-0 border-t" style={{ height: '24%', minHeight: 120, borderColor: C.border }}>
        <div ref={htfContainerRef} className="absolute inset-0" />
        <div className="absolute top-1.5 left-3 z-10 pointer-events-none font-mono text-[11px] flex gap-2">
          <span className="font-semibold" style={{ color: '#d1d4dc' }}>{macdLabel} · 4h</span>
          <span style={{ color: m4?.color ?? C.text }}>{mv(m4?.value)}</span>
          <span style={{ color: C.macd }}>{mv(m4?.macd)}</span>
          <span style={{ color: C.signal }}>{mv(m4?.signal)}</span>
          {m4 && <span style={{ color: C.textMuted }}>{formatBerlinTime(m4.time, true)}</span>}
        </div>
      </div>
    </div>
  );
}
