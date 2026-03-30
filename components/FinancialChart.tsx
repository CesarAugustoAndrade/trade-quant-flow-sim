import React, { useEffect, useRef } from 'react';
import { CandleData, MacdData, Trade } from '../types';

interface FinancialChartProps {
  candles: CandleData[];
  macdData: MacdData[];
  macd15Data?: MacdData[];
  priceLines: number[];
  trades: Trade[];
  currentPrice: number;
  emaData: { time: number; value: number }[];
  hma2Data: { time: number; value: number }[];
  hmaData: { time: number; value: number }[];
  hmaBandData: { time: number; value: number }[];
  isDrawingMode: boolean;
  isEma1Visible: boolean;
  isHma2Visible: boolean;
  isHmaVisible: boolean;
  isMacdVisible: boolean;
  macdConfig?: { fast: number; slow: number; signal: number };
  emaColor?: string;
  hma2Color?: string;
  hmaColor?: string;
  pricePrecision?: number;
  onChartClick: (price: number) => void;
}

const FinancialChartInner: React.FC<FinancialChartProps> = ({
  candles,
  macdData,
  macd15Data = [],
  priceLines,
  trades,
  currentPrice,
  emaData,
  hma2Data,
  hmaData,
  hmaBandData,
  isDrawingMode,
  isEma1Visible,
  isHma2Visible,
  isHmaVisible,
  isMacdVisible,
  macdConfig = { fast: 35, slow: 115, signal: 18 },
  emaColor = '#facc15',
  hma2Color = '#06b6d4',
  hmaColor = '#a855f7',
  pricePrecision = 2,
  onChartClick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const macd1mChartContainerRef = useRef<HTMLDivElement>(null);
  const macd15mChartContainerRef = useRef<HTMLDivElement>(null);

  // Chart instances
  const mainChartRef = useRef<any>(null);
  const macd1mChartRef = useRef<any>(null);
  const macd15mChartRef = useRef<any>(null);

  // 1-min MACD series
  const candleSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const hma2SeriesRef = useRef<any>(null);
  const hmaSeriesRef = useRef<any>(null);
  const hmaBandSeriesRef = useRef<any>(null);
  const histogramSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const signalLineSeriesRef = useRef<any>(null);

  // 15-min MTF MACD series
  const mtfMacdLineSeriesRef = useRef<any>(null);
  const mtfSignalLineSeriesRef = useRef<any>(null);

  // Drawing
  const priceLinesRef = useRef<Map<number, any>>(new Map());
  // Trade SL/TP lines
  const tradeLinesRef = useRef<Map<string, any>>(new Map());

  // Fix 2g-2: track last processed candle length for incremental updates
  const lastCandleLengthRef = useRef(0);

  // Initialization
  useEffect(() => {
    if (!mainChartContainerRef.current || !macd1mChartContainerRef.current || !macd15mChartContainerRef.current) return;

    // @ts-ignore
    if (!window.LightweightCharts) {
      console.error('LightweightCharts library not loaded.');
      return;
    }

    // @ts-ignore
    const { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode, LineStyle } = window.LightweightCharts;

    const commonOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#334155',
      },
      rightPriceScale: { borderColor: '#334155' },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    };

    // ── Main price chart ──────────────────────────────────────────────
    const mainChart = createChart(mainChartContainerRef.current, {
      ...commonOptions,
      width: mainChartContainerRef.current.clientWidth,
      height: mainChartContainerRef.current.clientHeight,
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: pricePrecision, minMove: Math.pow(10, -pricePrecision) },
    });
    const emaSeries = mainChart.addSeries(LineSeries, { color: emaColor, lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false, visible: isEma1Visible });
    const hma2Series = mainChart.addSeries(LineSeries, { color: hma2Color, lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false, visible: isHma2Visible });
    const hmaBandSeries = mainChart.addSeries(LineSeries, { color: hmaColor, lineWidth: 1, lineStyle: LineStyle.Dashed, crosshairMarkerVisible: false, priceLineVisible: false, visible: isHmaVisible });
    const hmaSeries = mainChart.addSeries(LineSeries, { color: hmaColor, lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false, visible: isHmaVisible });

    // ── 1-min MACD chart ──────────────────────────────────────────────
    const macd1mChart = createChart(macd1mChartContainerRef.current, {
      ...commonOptions,
      width: macd1mChartContainerRef.current.clientWidth,
      height: macd1mChartContainerRef.current.clientHeight,
    });

    const histogramSeries = macd1mChart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      visible: isMacdVisible,
    });
    const macdLineSeries = macd1mChart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      visible: isMacdVisible,
    });
    const signalLineSeries = macd1mChart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      visible: isMacdVisible,
    });

    // ── 15-min MTF MACD chart ─────────────────────────────────────────
    const macd15mChart = createChart(macd15mChartContainerRef.current, {
      ...commonOptions,
      width: macd15mChartContainerRef.current.clientWidth,
      height: macd15mChartContainerRef.current.clientHeight,
    });

    const mtfMacdLineSeries = macd15mChart.addSeries(LineSeries, {
      color: '#3b82f6',   // blue — matches TradingView screenshot
      lineWidth: 2,
      visible: isMacdVisible,
    });
    const mtfSignalLineSeries = macd15mChart.addSeries(LineSeries, {
      color: '#f97316',   // orange — matches TradingView screenshot
      lineWidth: 2,
      visible: isMacdVisible,
    });

    // ── 3-way time-scale sync ─────────────────────────────────────────
    const charts = [mainChart, macd1mChart, macd15mChart];
    let isSyncing = false;
    charts.forEach((source, si) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (isSyncing || range === null) return;
        isSyncing = true;
        charts.forEach((target, ti) => { if (ti !== si) target.timeScale().setVisibleLogicalRange(range); });
        isSyncing = false;
      });
    });

    // ── 3-way crosshair sync ──────────────────────────────────────────
    const syncCrosshair = (source: any, targets: { chart: any; series: any }[]) => {
      source.subscribeCrosshairMove((param: any) => {
        targets.forEach(({ chart, series }) => {
          if (param.time) chart.setCrosshairPosition(-1e9, param.time, series);
          else chart.clearCrosshairPosition();
        });
      });
    };
    syncCrosshair(mainChart, [{ chart: macd1mChart, series: histogramSeries }, { chart: macd15mChart, series: mtfMacdLineSeries }]);
    syncCrosshair(macd1mChart, [{ chart: mainChart, series: candleSeries }, { chart: macd15mChart, series: mtfMacdLineSeries }]);
    syncCrosshair(macd15mChart, [{ chart: mainChart, series: candleSeries }, { chart: macd1mChart, series: histogramSeries }]);

    // Store refs
    mainChartRef.current = mainChart;
    macd1mChartRef.current = macd1mChart;
    macd15mChartRef.current = macd15mChart;
    candleSeriesRef.current = candleSeries;
    emaSeriesRef.current = emaSeries;
    hma2SeriesRef.current = hma2Series;
    hmaSeriesRef.current = hmaSeries;
    hmaBandSeriesRef.current = hmaBandSeries;
    histogramSeriesRef.current = histogramSeries;
    macdLineSeriesRef.current = macdLineSeries;
    signalLineSeriesRef.current = signalLineSeries;
    mtfMacdLineSeriesRef.current = mtfMacdLineSeries;
    mtfSignalLineSeriesRef.current = mtfSignalLineSeries;

    // Resize handler
    const handleResize = () => {
      if (mainChartContainerRef.current) mainChart.applyOptions({ width: mainChartContainerRef.current.clientWidth, height: mainChartContainerRef.current.clientHeight });
      if (macd1mChartContainerRef.current) macd1mChart.applyOptions({ width: macd1mChartContainerRef.current.clientWidth, height: macd1mChartContainerRef.current.clientHeight });
      if (macd15mChartContainerRef.current) macd15mChart.applyOptions({ width: macd15mChartContainerRef.current.clientWidth, height: macd15mChartContainerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      macd1mChart.remove();
      macd15mChart.remove();
    };
  }, []);

  // Drawing mode handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDrawingMode && candleSeriesRef.current && mainChartContainerRef.current) {
      const rect = mainChartContainerRef.current.getBoundingClientRect();
      const price = candleSeriesRef.current.coordinateToPrice(e.clientY - rect.top);
      if (price !== null) onChartClick(price);
    }
  };

  // Dynamic colors
  useEffect(() => {
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ color: emaColor });
    if (hma2SeriesRef.current) hma2SeriesRef.current.applyOptions({ color: hma2Color });
    if (hmaSeriesRef.current) hmaSeriesRef.current.applyOptions({ color: hmaColor });
    if (hmaBandSeriesRef.current) hmaBandSeriesRef.current.applyOptions({ color: hmaColor });
  }, [emaColor, hma2Color, hmaColor]);

  // Visibility
  useEffect(() => {
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ visible: isEma1Visible });
    if (hma2SeriesRef.current) hma2SeriesRef.current.applyOptions({ visible: isHma2Visible });
    if (hmaSeriesRef.current) hmaSeriesRef.current.applyOptions({ visible: isHmaVisible });
    if (hmaBandSeriesRef.current) hmaBandSeriesRef.current.applyOptions({ visible: isHmaVisible });
    if (histogramSeriesRef.current) histogramSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (macdLineSeriesRef.current) macdLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (signalLineSeriesRef.current) signalLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (mtfMacdLineSeriesRef.current) mtfMacdLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (mtfSignalLineSeriesRef.current) mtfSignalLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
  }, [isEma1Visible, isHma2Visible, isHmaVisible, isMacdVisible]);

  // Cursor / crosshair mode
  useEffect(() => {
    if (!mainChartRef.current || !mainChartContainerRef.current) return;
    mainChartContainerRef.current.style.cursor = isDrawingMode ? 'crosshair' : 'default';
    // @ts-ignore
    const mode = isDrawingMode ? window.LightweightCharts.CrosshairMode.Magnet : window.LightweightCharts.CrosshairMode.Normal;
    mainChartRef.current.applyOptions({ crosshair: { mode } });
  }, [isDrawingMode]);

  // Fix 2g-2: Data — incremental candle updates
  useEffect(() => {
    if (!candleSeriesRef.current || !histogramSeriesRef.current) return;

    const lastLen = lastCandleLengthRef.current;

    if (candles.length === 0 || candles.length < lastLen) {
      // Reset or replay — full rebuild
      candleSeriesRef.current.setData(candles);
      if (emaSeriesRef.current) emaSeriesRef.current.setData(emaData);
      if (hma2SeriesRef.current) hma2SeriesRef.current.setData(hma2Data);
      if (hmaSeriesRef.current) hmaSeriesRef.current.setData(hmaData);
      if (hmaBandSeriesRef.current) hmaBandSeriesRef.current.setData(hmaBandData);

      // 1-min MACD
      histogramSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.value, color: d.color })));
      if (macdLineSeriesRef.current) macdLineSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.macd })));
      if (signalLineSeriesRef.current) signalLineSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.signal })));

      // 15-min MTF MACD
      if (macd15Data.length > 0) {
        if (mtfMacdLineSeriesRef.current) mtfMacdLineSeriesRef.current.setData(macd15Data.map(d => ({ time: d.time, value: d.macd })));
        if (mtfSignalLineSeriesRef.current) mtfSignalLineSeriesRef.current.setData(macd15Data.map(d => ({ time: d.time, value: d.signal })));
      }
    } else {
      // New candle appended OR last candle ticked — use update() for all series
      const lastCandle = candles[candles.length - 1];
      candleSeriesRef.current.update(lastCandle);

      if (emaData.length > 0 && emaSeriesRef.current) emaSeriesRef.current.update(emaData[emaData.length - 1]);
      if (hma2Data.length > 0 && hma2SeriesRef.current) hma2SeriesRef.current.update(hma2Data[hma2Data.length - 1]);
      if (hmaData.length > 0 && hmaSeriesRef.current) hmaSeriesRef.current.update(hmaData[hmaData.length - 1]);
      if (hmaBandData.length > 0 && hmaBandSeriesRef.current) hmaBandSeriesRef.current.update(hmaBandData[hmaBandData.length - 1]);

      // 1-min MACD
      if (macdData.length > 0) {
        const lastMacd = macdData[macdData.length - 1];
        histogramSeriesRef.current.update({ time: lastMacd.time, value: lastMacd.value, color: lastMacd.color });
        if (macdLineSeriesRef.current) macdLineSeriesRef.current.update({ time: lastMacd.time, value: lastMacd.macd });
        if (signalLineSeriesRef.current) signalLineSeriesRef.current.update({ time: lastMacd.time, value: lastMacd.signal });
      }

      // 15-min MTF MACD
      if (macd15Data.length > 0) {
        const lastMtf = macd15Data[macd15Data.length - 1];
        if (mtfMacdLineSeriesRef.current) mtfMacdLineSeriesRef.current.update({ time: lastMtf.time, value: lastMtf.macd });
        if (mtfSignalLineSeriesRef.current) mtfSignalLineSeriesRef.current.update({ time: lastMtf.time, value: lastMtf.signal });
      }
    }

    lastCandleLengthRef.current = candles.length;
  }, [candles, macdData, macd15Data, emaData, hma2Data, hmaData, hmaBandData]);

  // Price lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    priceLinesRef.current.forEach((line: any) => candleSeriesRef.current.removePriceLine(line));
    priceLinesRef.current.clear();
    priceLines.forEach(price => {
      const line = candleSeriesRef.current.createPriceLine({ price, color: '#f472b6', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'LEVEL' });
      priceLinesRef.current.set(price, line);
    });
  }, [priceLines]);

  // Fix 2f + 2g-3: Trade SL/TP/Entry lines — diffed, not cleared wholesale
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const openTrades = trades.filter(t => t.status === 'OPEN');
    const desiredKeys = new Set<string>();

    openTrades.forEach(trade => {
      if (trade.stopLoss !== undefined) desiredKeys.add(`${trade.id}-sl`);
      if (trade.takeProfit !== undefined) desiredKeys.add(`${trade.id}-tp`);
      if (trade.entryPrice !== undefined) desiredKeys.add(`${trade.id}-entry`);
    });

    // Remove lines that no longer exist
    tradeLinesRef.current.forEach((line: any, key: string) => {
      if (!desiredKeys.has(key)) {
        candleSeriesRef.current.removePriceLine(line);
        tradeLinesRef.current.delete(key);
      }
    });

    // Add lines that don't exist yet
    openTrades.forEach(trade => {
      if (trade.stopLoss !== undefined && !tradeLinesRef.current.has(`${trade.id}-sl`)) {
        const slPips = trade.entryPrice !== undefined
          ? Math.round(Math.abs(trade.entryPrice - trade.stopLoss) / 0.0001)
          : 0;
        const line = candleSeriesRef.current.createPriceLine({
          price: trade.stopLoss,
          color: '#f23645',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `SL ${slPips}p`,
        });
        tradeLinesRef.current.set(`${trade.id}-sl`, line);
      }

      if (trade.takeProfit !== undefined && !tradeLinesRef.current.has(`${trade.id}-tp`)) {
        const tpPips = trade.entryPrice !== undefined
          ? Math.round(Math.abs(trade.entryPrice - trade.takeProfit) / 0.0001)
          : 0;
        const line = candleSeriesRef.current.createPriceLine({
          price: trade.takeProfit,
          color: '#089981',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `TP ${tpPips}p`,
        });
        tradeLinesRef.current.set(`${trade.id}-tp`, line);
      }

      if (trade.entryPrice !== undefined && !tradeLinesRef.current.has(`${trade.id}-entry`)) {
        const line = candleSeriesRef.current.createPriceLine({
          price: trade.entryPrice,
          color: '#ffffff55',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'ENTRY',
        });
        tradeLinesRef.current.set(`${trade.id}-entry`, line);
      }
    });
  }, [trades]);

  return (
    <div ref={chartContainerRef} className="flex flex-col w-full h-full bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden select-none">

      {/* Pane 1: Price Chart */}
      <div className="relative flex-1 border-b border-slate-700" onMouseDown={handleMouseDown}>
        <div ref={mainChartContainerRef} className="w-full h-full" />
        <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-emerald-400 border border-emerald-900 pointer-events-none shadow-lg">
          LIVE: {currentPrice.toFixed(pricePrecision)}
        </div>
        {isDrawingMode && (
          <div className="absolute top-4 right-4 z-20 bg-amber-500/20 border border-amber-500 text-amber-400 px-3 py-1 rounded text-xs font-bold animate-pulse pointer-events-none">
            DRAWING MODE ACTIVE
          </div>
        )}
      </div>

      {/* Pane 2: 1-min MACD */}
      <div className="relative h-[22%] min-h-[100px] border-b border-slate-700 bg-slate-800/50">
        <div ref={macd1mChartContainerRef} className="w-full h-full" />
        <div className="absolute top-2 left-3 z-10 text-[10px] font-bold pointer-events-none uppercase tracking-widest flex items-center gap-1.5">
          <span className="text-slate-400">MACD</span>
          <span className="text-slate-500">{macdConfig.fast} {macdConfig.slow}</span>
          <span className="text-slate-600">close</span>
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
        </div>
      </div>

      {/* Pane 3: 15-min MTF MACD */}
      <div className="relative h-[22%] min-h-[100px] bg-slate-800/50">
        <div ref={macd15mChartContainerRef} className="w-full h-full" />
        <div className="absolute top-2 left-3 z-10 text-[10px] font-bold pointer-events-none uppercase tracking-widest flex items-center gap-1.5">
          <span className="text-slate-400">MACD MTF</span>
          <span className="text-slate-500">{macdConfig.fast} {macdConfig.slow} {macdConfig.signal}</span>
          <span className="text-slate-600">close</span>
          <span className="text-orange-400/80">15</span>
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
        </div>
      </div>

    </div>
  );
};

// Fix 2g-1: Wrap in React.memo with shallow comparator to prevent unnecessary re-renders
export const FinancialChart = React.memo(FinancialChartInner, (prev, next) => {
  // Re-render if candle count changed or last candle time changed
  if (prev.candles.length !== next.candles.length) return false;
  const prevLast = prev.candles[prev.candles.length - 1];
  const nextLast = next.candles[next.candles.length - 1];
  if (prevLast?.time !== nextLast?.time) return false;
  // Other prop comparisons
  if (prev.trades !== next.trades) return false;
  if (prev.priceLines !== next.priceLines) return false;
  if (prev.macdData !== next.macdData) return false;
  if (prev.macd15Data !== next.macd15Data) return false;
  if (prev.emaData !== next.emaData) return false;
  if (prev.hma2Data !== next.hma2Data) return false;
  if (prev.hmaData !== next.hmaData) return false;
  if (prev.hmaBandData !== next.hmaBandData) return false;
  if (prev.currentPrice !== next.currentPrice) return false;
  if (prev.isDrawingMode !== next.isDrawingMode) return false;
  if (prev.isEma1Visible !== next.isEma1Visible) return false;
  if (prev.isHma2Visible !== next.isHma2Visible) return false;
  if (prev.isHmaVisible !== next.isHmaVisible) return false;
  if (prev.isMacdVisible !== next.isMacdVisible) return false;
  if (prev.emaColor !== next.emaColor) return false;
  if (prev.hma2Color !== next.hma2Color) return false;
  if (prev.hmaColor !== next.hmaColor) return false;
  if (prev.pricePrecision !== next.pricePrecision) return false;
  return true;
});
