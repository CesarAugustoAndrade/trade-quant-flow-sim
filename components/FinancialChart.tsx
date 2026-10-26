import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CandleData, MacdData, Trade, Timeframe, TIMEFRAME_SECONDS } from '../types';

interface FinancialChartProps {
  candles: CandleData[];
  macdData: MacdData[];
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
  rsiChartData?: { time: number; rsi: number; signal: number }[];
  subChartMode?: 'macd' | 'rsi';
  macdConfig?: { fast: number; slow: number; signal: number };
  emaColor?: string;
  hma2Color?: string;
  hmaColor?: string;
  pricePrecision?: number;
  timeframe: Timeframe;
  dataVersion: number; // changes when the series are rebuilt wholesale, forcing a full setData
  onTimeframeChange: (tf: Timeframe) => void;
  onChartClick: (price: number) => void;
}

const FinancialChartInner: React.FC<FinancialChartProps> = ({
  candles,
  macdData,
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
  rsiChartData = [],
  subChartMode = 'macd',
  macdConfig = { fast: 35, slow: 115, signal: 18 },
  emaColor = '#facc15',
  hma2Color = '#06b6d4',
  hmaColor = '#a855f7',
  pricePrecision = 2,
  timeframe,
  dataVersion,
  onTimeframeChange,
  onChartClick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const macd1mChartContainerRef = useRef<HTMLDivElement>(null);

  // Chart instances
  const mainChartRef = useRef<any>(null);
  const macd1mChartRef = useRef<any>(null);

  // 1-min MACD series
  const candleSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const hma2SeriesRef = useRef<any>(null);
  const hmaSeriesRef = useRef<any>(null);
  const hmaBandSeriesRef = useRef<any>(null);
  const histogramSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const signalLineSeriesRef = useRef<any>(null);

  // RSI chart
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiLineSeriesRef = useRef<any>(null);
  const rsiSignalSeriesRef = useRef<any>(null);

  // Drawing
  const priceLinesRef = useRef<Map<number, any>>(new Map());
  // Trade SL/TP lines
  const tradeLinesRef = useRef<Map<string, any>>(new Map());

  // Pencil drawing overlay
  const pencilCanvasRef = useRef<HTMLCanvasElement>(null);
  const pencilStrokesRef = useRef<Array<{ points: { x: number; y: number }[]; color: string }>>([]);
  const isStrokingRef = useRef(false);
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const [pencilColor] = useState('#f59e0b');
  const [strokeCount, setStrokeCount] = useState(0);

  // Fix 2g-2: track last processed candle length for incremental updates
  const lastCandleLengthRef = useRef(0);
  const lastTimeframeRef = useRef(timeframe);
  const lastDataVersionRef = useRef(dataVersion);

  // Initialization
  useEffect(() => {
    if (!mainChartContainerRef.current || !macd1mChartContainerRef.current || !rsiChartContainerRef.current) return;

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
      visible: subChartMode === 'macd',
    });
    const macdLineSeries = macd1mChart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      visible: subChartMode === 'macd',
    });
    const signalLineSeries = macd1mChart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      visible: subChartMode === 'macd',
    });

    // ── RSI chart ─────────────────────────────────────────────────────
    const rsiChart = createChart(rsiChartContainerRef.current, {
      ...commonOptions,
      width: rsiChartContainerRef.current.clientWidth,
      height: rsiChartContainerRef.current.clientHeight,
    });

    // RSI line
    const rsiLineSeries = rsiChart.addSeries(LineSeries, {
      color: '#d1d4dc',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Signal line
    const rsiSignalSeries = rsiChart.addSeries(LineSeries, {
      color: '#ff5d00',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // OB/OS/Mid levels
    rsiLineSeries.createPriceLine({ price: 80, color: '#08998155', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
    rsiLineSeries.createPriceLine({ price: 50, color: '#787b8644', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
    rsiLineSeries.createPriceLine({ price: 20, color: '#f2364555', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });

    rsiChartRef.current = rsiChart;
    rsiLineSeriesRef.current = rsiLineSeries;
    rsiSignalSeriesRef.current = rsiSignalSeries;

    // ── 2-way time-scale sync ─────────────────────────────────────────
    const charts = [mainChart, macd1mChart, rsiChart];
    let isSyncing = false;
    charts.forEach((source, si) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (isSyncing || range === null) return;
        isSyncing = true;
        charts.forEach((target, ti) => { if (ti !== si) target.timeScale().setVisibleLogicalRange(range); });
        isSyncing = false;
      });
    });

    // ── 2-way crosshair sync ──────────────────────────────────────────
    const syncCrosshair = (source: any, targets: { chart: any; series: any }[]) => {
      source.subscribeCrosshairMove((param: any) => {
        targets.forEach(({ chart, series }) => {
          if (param.time) chart.setCrosshairPosition(-1e9, param.time, series);
          else chart.clearCrosshairPosition();
        });
      });
    };
    syncCrosshair(mainChart, [{ chart: macd1mChart, series: histogramSeries }, { chart: rsiChart, series: rsiLineSeries }]);
    syncCrosshair(macd1mChart, [{ chart: mainChart, series: candleSeries }, { chart: rsiChart, series: rsiLineSeries }]);
    syncCrosshair(rsiChart, [{ chart: mainChart, series: candleSeries }, { chart: macd1mChart, series: histogramSeries }]);

    // Store refs
    mainChartRef.current = mainChart;
    macd1mChartRef.current = macd1mChart;
    candleSeriesRef.current = candleSeries;
    emaSeriesRef.current = emaSeries;
    hma2SeriesRef.current = hma2Series;
    hmaSeriesRef.current = hmaSeries;
    hmaBandSeriesRef.current = hmaBandSeries;
    histogramSeriesRef.current = histogramSeries;
    macdLineSeriesRef.current = macdLineSeries;
    signalLineSeriesRef.current = signalLineSeries;

    // Resize handler
    const handleResize = () => {
      if (mainChartContainerRef.current) mainChart.applyOptions({ width: mainChartContainerRef.current.clientWidth, height: mainChartContainerRef.current.clientHeight });
      if (macd1mChartContainerRef.current) macd1mChart.applyOptions({ width: macd1mChartContainerRef.current.clientWidth, height: macd1mChartContainerRef.current.clientHeight });
      if (rsiChartContainerRef.current) rsiChart.applyOptions({ width: rsiChartContainerRef.current.clientWidth, height: rsiChartContainerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      macd1mChart.remove();
      rsiChart.remove();
    };
  }, []);

  // Redraw all pencil strokes on the overlay canvas
  const redrawPencilCanvas = useCallback(() => {
    const canvas = pencilCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of pencilStrokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, []);

  // Clear all pencil drawings
  const clearPencilDrawings = useCallback(() => {
    pencilStrokesRef.current = [];
    setStrokeCount(0);
    const canvas = pencilCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Resize pencil canvas to match chart container
  useEffect(() => {
    const container = mainChartContainerRef.current;
    const canvas = pencilCanvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawPencilCanvas();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawPencilCanvas]);

  // Drawing mode handler — click places line, drag draws freehand
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingMode || !mainChartContainerRef.current) return;
    const rect = mainChartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isStrokingRef.current = true;
    strokeStartRef.current = { x, y };
    currentStrokeRef.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isStrokingRef.current || !isDrawingMode || !mainChartContainerRef.current) return;
    const rect = mainChartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStrokeRef.current.push({ x, y });
    // Live draw on canvas
    const canvas = pencilCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = currentStrokeRef.current;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = pencilColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isStrokingRef.current || !isDrawingMode) { isStrokingRef.current = false; return; }
    isStrokingRef.current = false;
    const start = strokeStartRef.current;
    if (!start || !mainChartContainerRef.current) return;
    const rect = mainChartContainerRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const dist = Math.sqrt((endX - start.x) ** 2 + (endY - start.y) ** 2);
    if (dist < 5) {
      // Short click — place horizontal price line (existing behavior)
      if (candleSeriesRef.current) {
        const price = candleSeriesRef.current.coordinateToPrice(e.clientY - rect.top);
        if (price !== null) onChartClick(price);
      }
    } else {
      // Drag — save pencil stroke
      pencilStrokesRef.current.push({ points: [...currentStrokeRef.current], color: pencilColor });
      setStrokeCount(pencilStrokesRef.current.length);
    }
    currentStrokeRef.current = [];
    strokeStartRef.current = null;
  };

  const handleMouseLeave = () => {
    if (isStrokingRef.current && currentStrokeRef.current.length > 1) {
      pencilStrokesRef.current.push({ points: [...currentStrokeRef.current], color: pencilColor });
      setStrokeCount(pencilStrokesRef.current.length);
    }
    isStrokingRef.current = false;
    currentStrokeRef.current = [];
    strokeStartRef.current = null;
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
  }, [isEma1Visible, isHma2Visible, isHmaVisible]);

  // Sub-chart mode visibility (MACD / RSI)
  useEffect(() => {
    const showMacd = subChartMode === 'macd';
    if (histogramSeriesRef.current) histogramSeriesRef.current.applyOptions({ visible: showMacd });
    if (macdLineSeriesRef.current) macdLineSeriesRef.current.applyOptions({ visible: showMacd });
    if (signalLineSeriesRef.current) signalLineSeriesRef.current.applyOptions({ visible: showMacd });
    const showRsi = subChartMode === 'rsi';
    if (rsiLineSeriesRef.current) rsiLineSeriesRef.current.applyOptions({ visible: showRsi });
    if (rsiSignalSeriesRef.current) rsiSignalSeriesRef.current.applyOptions({ visible: showRsi });
  }, [subChartMode]);

  // Crosshair mode for drawing
  useEffect(() => {
    if (!mainChartRef.current) return;
    // @ts-ignore
    const mode = isDrawingMode ? window.LightweightCharts.CrosshairMode.Magnet : window.LightweightCharts.CrosshairMode.Normal;
    mainChartRef.current.applyOptions({ crosshair: { mode } });
  }, [isDrawingMode]);

  // Fix 2g-2: Data — incremental candle updates
  useEffect(() => {
    if (!candleSeriesRef.current || !histogramSeriesRef.current) return;

    const lastLen = lastCandleLengthRef.current;
    const timeframeChanged = timeframe !== lastTimeframeRef.current;

    if (candles.length === 0 || candles.length < lastLen || timeframeChanged || dataVersion !== lastDataVersionRef.current) {
      // Reset, replay, timeframe switch or indicator rebuild — full rebuild
      candleSeriesRef.current.setData(candles);
      if (emaSeriesRef.current) emaSeriesRef.current.setData(emaData);
      if (hma2SeriesRef.current) hma2SeriesRef.current.setData(hma2Data);
      if (hmaSeriesRef.current) hmaSeriesRef.current.setData(hmaData);
      if (hmaBandSeriesRef.current) hmaBandSeriesRef.current.setData(hmaBandData);

      // 1-min MACD
      histogramSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.value, color: d.color })));
      if (macdLineSeriesRef.current) macdLineSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.macd })));
      if (signalLineSeriesRef.current) signalLineSeriesRef.current.setData(macdData.map(d => ({ time: d.time, value: d.signal })));

      // RSI (always replaced: leftover points newer than the incoming data would make update() throw)
      if (rsiLineSeriesRef.current) rsiLineSeriesRef.current.setData(rsiChartData.map(d => ({ time: d.time, value: d.rsi })));
      if (rsiSignalSeriesRef.current) rsiSignalSeriesRef.current.setData(rsiChartData.map(d => ({ time: d.time, value: d.signal })));

      if (timeframeChanged && mainChartRef.current) mainChartRef.current.timeScale().scrollToRealTime();

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

      // RSI
      if (rsiChartData.length > 0) {
        const lastRsi = rsiChartData[rsiChartData.length - 1];
        if (rsiLineSeriesRef.current) rsiLineSeriesRef.current.update({ time: lastRsi.time, value: lastRsi.rsi });
        if (rsiSignalSeriesRef.current) rsiSignalSeriesRef.current.update({ time: lastRsi.time, value: lastRsi.signal });
      }

    }

    lastCandleLengthRef.current = candles.length;
    lastTimeframeRef.current = timeframe;
    lastDataVersionRef.current = dataVersion;
  }, [candles, macdData, emaData, hma2Data, hmaData, hmaBandData, rsiChartData, timeframe, dataVersion]);

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
      <div className="relative flex-1 border-b border-slate-700">
        <div ref={mainChartContainerRef} className="w-full h-full" />
        {/* Pencil drawing overlay */}
        <canvas
          ref={pencilCanvasRef}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: isDrawingMode ? 'auto' : 'none', cursor: isDrawingMode ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-emerald-400 border border-emerald-900 shadow-lg">
            LIVE: {currentPrice.toFixed(pricePrecision)}
          </div>
          <div className="flex bg-slate-900/80 backdrop-blur rounded border border-slate-700 overflow-hidden text-xs font-mono shadow-lg pointer-events-auto">
            {(Object.keys(TIMEFRAME_SECONDS) as Timeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-1 transition-colors ${tf === timeframe ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        {isDrawingMode && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
            <div className="bg-amber-500/20 border border-amber-500 text-amber-400 px-3 py-1 rounded text-xs font-bold animate-pulse">
              DRAW — click: line | drag: pencil
            </div>
            {strokeCount > 0 && (
              <button
                onClick={clearPencilDrawings}
                className="bg-red-500/20 border border-red-500 text-red-400 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-500/40 transition-colors"
              >
                CLEAR ({strokeCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pane 2: Sub-chart (MACD or RSI) */}
      <div className="relative h-[22%] min-h-[100px] border-b border-slate-700 bg-slate-800/50">
        {/* MACD container */}
        <div ref={macd1mChartContainerRef} className="w-full h-full absolute inset-0" style={{ visibility: subChartMode === 'macd' ? 'visible' : 'hidden' }} />
        {/* RSI container */}
        <div ref={rsiChartContainerRef} className="w-full h-full absolute inset-0" style={{ visibility: subChartMode === 'rsi' ? 'visible' : 'hidden' }} />
        {/* Label */}
        <div className="absolute top-2 left-3 z-10 text-[10px] font-bold pointer-events-none uppercase tracking-widest flex items-center gap-1.5">
          {subChartMode === 'macd' ? (
            <>
              <span className="text-slate-400">MACD</span>
              <span className="text-slate-500">{macdConfig.fast} {macdConfig.slow}</span>
              <span className="text-slate-600">close</span>
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            </>
          ) : (
            <>
              <span className="text-slate-400">RSI</span>
              <span className="text-slate-500">14 / 14</span>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#d1d4dc' }} />
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#ff5d00' }} />
            </>
          )}
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
  // A forming higher-timeframe bar keeps its time while its OHLC changes
  if (prevLast?.close !== nextLast?.close || prevLast?.high !== nextLast?.high || prevLast?.low !== nextLast?.low) return false;
  if (prev.timeframe !== next.timeframe) return false;
  if (prev.dataVersion !== next.dataVersion) return false;
  // Other prop comparisons
  if (prev.trades !== next.trades) return false;
  if (prev.priceLines !== next.priceLines) return false;
  if (prev.macdData !== next.macdData) return false;
  if (prev.emaData !== next.emaData) return false;
  if (prev.hma2Data !== next.hma2Data) return false;
  if (prev.hmaData !== next.hmaData) return false;
  if (prev.hmaBandData !== next.hmaBandData) return false;
  if (prev.currentPrice !== next.currentPrice) return false;
  if (prev.isDrawingMode !== next.isDrawingMode) return false;
  if (prev.isEma1Visible !== next.isEma1Visible) return false;
  if (prev.isHma2Visible !== next.isHma2Visible) return false;
  if (prev.isHmaVisible !== next.isHmaVisible) return false;
  if (prev.subChartMode !== next.subChartMode) return false;
  if (prev.rsiChartData !== next.rsiChartData) return false;
  if (prev.emaColor !== next.emaColor) return false;
  if (prev.hma2Color !== next.hma2Color) return false;
  if (prev.hmaColor !== next.hmaColor) return false;
  if (prev.pricePrecision !== next.pricePrecision) return false;
  return true;
});
