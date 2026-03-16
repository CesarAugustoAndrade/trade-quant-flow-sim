




import React, { useEffect, useRef } from 'react';
import { CandleData, MacdData } from '../types';

interface FinancialChartProps {
  candles: CandleData[];
  macdData: MacdData[];
  priceLines: number[];
  currentPrice: number;
  emaData: { time: number; value: number }[];
  hma2Data: { time: number; value: number }[]; // Was EMA 2
  hmaData: { time: number; value: number }[];
  hmaBandData: { time: number; value: number }[];
  isDrawingMode: boolean;
  isEma1Visible: boolean;
  isHma2Visible: boolean; // Was EMA 2
  isHmaVisible: boolean;
  isMacdVisible: boolean;
  macdConfig?: { fast: number; slow: number; signal: number };
  emaColor?: string;
  hma2Color?: string; // Was EMA 2
  hmaColor?: string;
  onChartClick: (price: number) => void;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ 
  candles, 
  macdData, 
  priceLines,
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
  emaColor = '#facc15', // Default yellow
  hma2Color = '#06b6d4', // Default Cyan
  hmaColor = '#a855f7', // Default Violet
  onChartClick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const indicatorChartContainerRef = useRef<HTMLDivElement>(null);

  // Chart Instances
  const mainChartRef = useRef<any>(null);
  const indicatorChartRef = useRef<any>(null);
  
  // Series Refs
  const candleSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null); // EMA 1
  const hma2SeriesRef = useRef<any>(null); // HMA 2 (was EMA 2)
  const hmaSeriesRef = useRef<any>(null); // HMA 1
  const hmaBandSeriesRef = useRef<any>(null); // HMA 1 Band
  const histogramSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const signalLineSeriesRef = useRef<any>(null);
  
  // Object Refs for Drawing
  const priceLinesRef = useRef<Map<number, any>>(new Map());

  // Initialization Effect
  useEffect(() => {
    if (!mainChartContainerRef.current || !indicatorChartContainerRef.current) return;

    // @ts-ignore - accessing global script
    if (!window.LightweightCharts) {
        console.error("LightweightCharts library not loaded.");
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
      rightPriceScale: {
        borderColor: '#334155',
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
    };

    // --- Main Chart (Price) ---
    const mainChart = createChart(mainChartContainerRef.current, {
      ...commonOptions,
      width: mainChartContainerRef.current.clientWidth,
      height: mainChartContainerRef.current.clientHeight,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // Tailwind emerald-500
      downColor: '#ef4444', // Tailwind red-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // EMA Series 1
    const emaSeries = mainChart.addSeries(LineSeries, {
      color: emaColor, 
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      visible: isEma1Visible,
    });

    // HMA Series 2 (Was EMA 2)
    const hma2Series = mainChart.addSeries(LineSeries, {
      color: hma2Color, 
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      visible: isHma2Visible,
    });

    // HMA Series 1 Band (Subtle)
    const hmaBandSeries = mainChart.addSeries(LineSeries, {
        color: hmaColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        visible: isHmaVisible,
    });

    // HMA Series 1 Main
    const hmaSeries = mainChart.addSeries(LineSeries, {
      color: hmaColor, 
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      visible: isHmaVisible,
    });

    // --- Indicator Chart (MACD) ---
    const indicatorChart = createChart(indicatorChartContainerRef.current, {
      ...commonOptions,
      width: indicatorChartContainerRef.current.clientWidth,
      height: indicatorChartContainerRef.current.clientHeight,
    });

    // Histogram
    const histogramSeries = indicatorChart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      visible: isMacdVisible,
    });
    
    // MACD Line
    const macdLineSeries = indicatorChart.addSeries(LineSeries, {
      color: '#3b82f6', // Blue
      lineWidth: 1,
      visible: isMacdVisible,
    });

    // Signal Line
    const signalLineSeries = indicatorChart.addSeries(LineSeries, {
      color: '#f59e0b', // Orange
      lineWidth: 1,
      visible: isMacdVisible,
    });

    // --- Synchronization Logic ---
    let isSyncingLeft = false;
    let isSyncingRight = false;

    const syncTimeScales = (source: any, target: any, isSourceLeft: boolean) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range === null) return;
        if (isSourceLeft ? isSyncingLeft : isSyncingRight) return;
        if (isSourceLeft) isSyncingRight = true;
        else isSyncingLeft = true;
        target.timeScale().setVisibleLogicalRange(range);
        if (isSourceLeft) isSyncingRight = false;
        else isSyncingLeft = false;
      });
    };

    syncTimeScales(mainChart, indicatorChart, true);
    syncTimeScales(indicatorChart, mainChart, false);

    // Sync Crosshair
    const syncCrosshair = (source: any, target: any, targetSeries: any) => {
      source.subscribeCrosshairMove((param: any) => {
        if (param.time) {
          target.setCrosshairPosition(-1000000, param.time, targetSeries);
        } else {
          target.clearCrosshairPosition();
        }
      });
    };

    syncCrosshair(mainChart, indicatorChart, histogramSeries);
    syncCrosshair(indicatorChart, mainChart, candleSeries);

    // Store Refs
    mainChartRef.current = mainChart;
    indicatorChartRef.current = indicatorChart;
    candleSeriesRef.current = candleSeries;
    emaSeriesRef.current = emaSeries;
    hma2SeriesRef.current = hma2Series;
    hmaSeriesRef.current = hmaSeries;
    hmaBandSeriesRef.current = hmaBandSeries;
    histogramSeriesRef.current = histogramSeries;
    macdLineSeriesRef.current = macdLineSeries;
    signalLineSeriesRef.current = signalLineSeries;

    // Handle Resize
    const handleResize = () => {
      if (mainChartContainerRef.current && indicatorChartContainerRef.current) {
        mainChart.applyOptions({ 
            width: mainChartContainerRef.current.clientWidth, 
            height: mainChartContainerRef.current.clientHeight 
        });
        indicatorChart.applyOptions({ 
            width: indicatorChartContainerRef.current.clientWidth, 
            height: indicatorChartContainerRef.current.clientHeight 
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      indicatorChart.remove();
    };
  }, []);

  // --- Mouse Event Handlers for Custom Interaction ---
  const handleMouseDown = (e: React.MouseEvent) => {
      // 1. Handle Drawing Mode (Click to place line)
      if (isDrawingMode && candleSeriesRef.current && mainChartRef.current) {
          const rect = mainChartContainerRef.current?.getBoundingClientRect();
          if (rect) {
              const y = e.clientY - rect.top;
              const price = candleSeriesRef.current.coordinateToPrice(y);
              if (price !== null) {
                  onChartClick(price);
              }
          }
          return;
      }
  };


  // --- Effects ---

  // Update Dynamic EMA Colors
  useEffect(() => {
    if (emaSeriesRef.current) {
      emaSeriesRef.current.applyOptions({ color: emaColor });
    }
    if (hma2SeriesRef.current) {
      hma2SeriesRef.current.applyOptions({ color: hma2Color });
    }
    if (hmaSeriesRef.current) {
      hmaSeriesRef.current.applyOptions({ color: hmaColor });
    }
    if (hmaBandSeriesRef.current) {
        hmaBandSeriesRef.current.applyOptions({ color: hmaColor });
    }
  }, [emaColor, hma2Color, hmaColor]);

  // Update Visibility
  useEffect(() => {
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ visible: isEma1Visible });
    if (hma2SeriesRef.current) hma2SeriesRef.current.applyOptions({ visible: isHma2Visible });
    if (hmaSeriesRef.current) hmaSeriesRef.current.applyOptions({ visible: isHmaVisible });
    if (hmaBandSeriesRef.current) hmaBandSeriesRef.current.applyOptions({ visible: isHmaVisible });
    
    if (histogramSeriesRef.current) histogramSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (macdLineSeriesRef.current) macdLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
    if (signalLineSeriesRef.current) signalLineSeriesRef.current.applyOptions({ visible: isMacdVisible });
  }, [isEma1Visible, isHma2Visible, isHmaVisible, isMacdVisible]);

  // Update Cursor Styles based on mode
  useEffect(() => {
      if(!mainChartRef.current || !mainChartContainerRef.current) return;
      
      const cursor = isDrawingMode ? 'crosshair' : 'default';
      mainChartContainerRef.current.style.cursor = cursor;
      
      const crosshairMode = isDrawingMode
          // @ts-ignore
          ? window.LightweightCharts.CrosshairMode.Magnet 
          // @ts-ignore
          : window.LightweightCharts.CrosshairMode.Normal;

      mainChartRef.current.applyOptions({ crosshair: { mode: crosshairMode } });

  }, [isDrawingMode]);


  // Data Update Effect
  useEffect(() => {
    if (!candleSeriesRef.current || !histogramSeriesRef.current || !emaSeriesRef.current || !hma2SeriesRef.current || !hmaSeriesRef.current) return;

    candleSeriesRef.current.setData(candles);
    emaSeriesRef.current.setData(emaData);
    hma2SeriesRef.current.setData(hma2Data);
    hmaSeriesRef.current.setData(hmaData);
    if(hmaBandSeriesRef.current) hmaBandSeriesRef.current.setData(hmaBandData);

    // Map MACD data
    const histData = macdData.map(d => ({ 
      time: d.time, 
      value: d.value, 
      color: d.color
    }));
    const macdLineData = macdData.map(d => ({ time: d.time, value: d.macd }));
    const signalLineData = macdData.map(d => ({ time: d.time, value: d.signal }));

    histogramSeriesRef.current.setData(histData);
    macdLineSeriesRef.current.setData(macdLineData);
    signalLineSeriesRef.current.setData(signalLineData);

  }, [candles, macdData, emaData, hma2Data, hmaData, hmaBandData]);

  // Price Lines Effect (Horizontal Levels)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove old lines
    priceLinesRef.current.forEach((line: any) => {
        candleSeriesRef.current.removePriceLine(line);
    });
    priceLinesRef.current.clear();

    // Add new lines
    priceLines.forEach((price) => {
        const line = candleSeriesRef.current.createPriceLine({
            price: price,
            color: '#f472b6', // Pink 400
            lineWidth: 2,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: 'LEVEL',
        });
        priceLinesRef.current.set(price, line);
    });

  }, [priceLines]);

  return (
    <div ref={chartContainerRef} className="flex flex-col w-full h-full bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden select-none">
      
      {/* Top Pane: Price Chart */}
      <div 
        className="relative flex-1 border-b border-slate-700 group"
        onMouseDown={handleMouseDown}
      >
        <div ref={mainChartContainerRef} className="w-full h-full relative z-0" />

        <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-emerald-400 border border-emerald-900 pointer-events-none shadow-lg">
          LIVE: {currentPrice.toFixed(2)}
        </div>
        {isDrawingMode && (
            <div className="absolute top-4 right-4 z-20 bg-amber-500/20 border border-amber-500 text-amber-400 px-3 py-1 rounded text-xs font-bold animate-pulse pointer-events-none">
                DRAWING MODE ACTIVE
            </div>
        )}
      </div>

      {/* Bottom Pane: MACD Indicator */}
      <div className="relative h-[30%] min-h-[120px] bg-slate-800/50">
        <div ref={indicatorChartContainerRef} className="w-full h-full" />
        <div className="absolute top-2 left-4 z-10 text-[10px] font-bold text-slate-500 pointer-events-none uppercase tracking-widest">
            MACD ({macdConfig.fast}, {macdConfig.slow}, {macdConfig.signal})
        </div>
      </div>

    </div>
  );
};