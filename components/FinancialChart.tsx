
import React, { useEffect, useRef, useState } from 'react';
import { CandleData, MacdData, ChartZone } from '../types';

interface FinancialChartProps {
  candles: CandleData[];
  macdData: MacdData[];
  priceLines: number[];
  chartZones: ChartZone[];
  currentPrice: number;
  emaData: { time: number; value: number }[];
  isDrawingMode: boolean;
  isZoneMode: boolean;
  macdConfig?: { fast: number; slow: number; signal: number };
  emaColor?: string;
  onChartClick: (price: number) => void;
  onZoneComplete: (zone: ChartZone) => void;
  onRemoveZone: (id: string) => void;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ 
  candles, 
  macdData, 
  priceLines,
  chartZones,
  currentPrice,
  emaData,
  isDrawingMode,
  isZoneMode,
  macdConfig = { fast: 35, slow: 115, signal: 18 },
  emaColor = '#facc15', // Default yellow
  onChartClick,
  onZoneComplete,
  onRemoveZone
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const indicatorChartContainerRef = useRef<HTMLDivElement>(null);

  // Chart Instances
  const mainChartRef = useRef<any>(null);
  const indicatorChartRef = useRef<any>(null);
  
  // Series Refs
  const candleSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null); // EMA
  const histogramSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const signalLineSeriesRef = useRef<any>(null);
  
  // Object Refs for Drawing
  const priceLinesRef = useRef<Map<number, any>>(new Map());
  
  // Dragging State Refs (Using refs to avoid re-renders during 60fps drag)
  const isDraggingZone = useRef(false);
  const dragStart = useRef<{price: number, time: number} | null>(null);
  const tempZoneEnd = useRef<{price: number, time: number} | null>(null);

  // Overlay State for Zones
  const [renderedZones, setRenderedZones] = useState<any[]>([]);
  const [tempZoneStyle, setTempZoneStyle] = useState<any>(null);

  // Initialization Effect
  useEffect(() => {
    if (!mainChartContainerRef.current || !indicatorChartContainerRef.current) return;

    // @ts-ignore - accessing global script
    if (!window.LightweightCharts) {
        console.error("LightweightCharts library not loaded.");
        return;
    }

    // @ts-ignore
    const { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, CrosshairMode } = window.LightweightCharts;

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

    // EMA Series
    const emaSeries = mainChart.addSeries(LineSeries, {
      color: emaColor, 
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
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
    });
    
    // MACD Line
    const macdLineSeries = indicatorChart.addSeries(LineSeries, {
      color: '#3b82f6', // Blue
      lineWidth: 1,
    });

    // Signal Line
    const signalLineSeries = indicatorChart.addSeries(LineSeries, {
      color: '#f59e0b', // Orange
      lineWidth: 1,
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


  // --- Zone Overlay Calculation Logic ---
  // We need to listen to chart updates to recalculate the positions of the HTML overlays
  const updateZonePositions = () => {
      if (!mainChartRef.current || !candleSeriesRef.current) return;
      
      const chart = mainChartRef.current;
      const series = candleSeriesRef.current;
      const timeScale = chart.timeScale();

      // Helper to calculate style for a zone
      const getZoneStyle = (zStartPrice: number, zStartTime: number, zEndPrice: number, zEndTime: number) => {
          const y1 = series.priceToCoordinate(zStartPrice);
          const y2 = series.priceToCoordinate(zEndPrice);
          const x1 = timeScale.timeToCoordinate(zStartTime);
          const x2 = timeScale.timeToCoordinate(zEndTime);

          // If any coordinate is null, the point is off-screen or invalid
          if (y1 === null || y2 === null) return null;

          // x1/x2 might be null if far off screen, but let's handle graceful degradation
          // If x1 is null but x2 is valid, start is off-screen left, etc.
          // However, timeToCoordinate usually returns null only if strictly invalid, 
          // let's assume we might need logic for off-screen. 
          // For simplicity in this demo, if null we hide, or we could clamp.
          
          const validX1 = x1 !== null ? x1 : (zStartTime < timeScale.getVisibleLogicalRange()?.from ? -1000 : 10000); 
          const validX2 = x2 !== null ? x2 : (zEndTime < timeScale.getVisibleLogicalRange()?.from ? -1000 : 10000);

          const top = Math.min(y1, y2);
          const height = Math.abs(y1 - y2);
          const left = Math.min(validX1, validX2);
          const width = Math.abs(validX1 - validX2);

          return { top, left, width, height };
      };

      // 1. Rendered Zones
      const updatedZones = chartZones.map(z => {
          const style = getZoneStyle(z.startPrice, z.startPrice, z.endPrice, z.endTime); // Error in logic here? No.
          // Wait, ChartZone has startTime/endTime.
          const s = getZoneStyle(z.startPrice, z.startTime, z.endPrice, z.endTime);
          return { ...z, style: s };
      });
      setRenderedZones(updatedZones);

      // 2. Temp Drawing Zone
      if (isDraggingZone.current && dragStart.current && tempZoneEnd.current) {
          const s = getZoneStyle(
              dragStart.current.price, 
              dragStart.current.time, 
              tempZoneEnd.current.price, 
              tempZoneEnd.current.time
          );
          setTempZoneStyle(s);
      } else {
          setTempZoneStyle(null);
      }
  };

  // Subscribe to chart updates for overlay syncing
  useEffect(() => {
      if (!mainChartRef.current) return;
      
      const chart = mainChartRef.current;
      const handleUpdate = () => {
          requestAnimationFrame(updateZonePositions);
      };

      chart.timeScale().subscribeVisibleLogicalRangeChange(handleUpdate);
      chart.subscribeCrosshairMove(handleUpdate); // For smoother dragging updates

      return () => {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleUpdate);
          chart.unsubscribeCrosshairMove(handleUpdate);
      };
  }, [chartZones]); // Re-bind when zones change to ensure they are captured in closure


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

      // 2. Handle Zone Mode (Drag start)
      if (isZoneMode && candleSeriesRef.current && mainChartRef.current && mainChartContainerRef.current) {
           const rect = mainChartContainerRef.current.getBoundingClientRect();
           const x = e.clientX - rect.left;
           const y = e.clientY - rect.top;
           
           const price = candleSeriesRef.current.coordinateToPrice(y);
           const time = mainChartRef.current.timeScale().coordinateToTime(x);
           
           if (price !== null && time !== null) {
               isDraggingZone.current = true;
               dragStart.current = { price, time };
               tempZoneEnd.current = { price, time }; // Initialize end same as start
               
               // Disable chart scrolling while dragging
               mainChartRef.current.applyOptions({
                   handleScroll: { mouseWheel: false, pressedMouseMove: false },
                   handleScale: { axisPressedMouseMove: false }
               });
           }
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDraggingZone.current && dragStart.current && candleSeriesRef.current && mainChartRef.current) {
          const rect = mainChartContainerRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const currentPrice = candleSeriesRef.current.coordinateToPrice(y);
          const currentTime = mainChartRef.current.timeScale().coordinateToTime(x);
          
          if (currentPrice !== null && currentTime !== null) {
              tempZoneEnd.current = { price: currentPrice, time: currentTime };
              // We rely on subscribeCrosshairMove to trigger the render update via updateZonePositions
          }
      }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      if (isDraggingZone.current && dragStart.current && tempZoneEnd.current) {
           // Commit Zone
           // Ensure valid dimensions (not 0 width/height)
           if (Math.abs(dragStart.current.price - tempZoneEnd.current.price) > 0) {
               onZoneComplete({
                   id: Math.random().toString(36).substr(2, 9),
                   startPrice: dragStart.current.price,
                   startTime: dragStart.current.time as number,
                   endPrice: tempZoneEnd.current.price,
                   endTime: tempZoneEnd.current.time as number,
                   color: 'rgba(34, 197, 94, 0.2)' // Default Green
               });
           }

           // Cleanup
           isDraggingZone.current = false;
           dragStart.current = null;
           tempZoneEnd.current = null;
           setTempZoneStyle(null);

           // Re-enable chart scrolling
           mainChartRef.current.applyOptions({
                handleScroll: { mouseWheel: true, pressedMouseMove: true },
                handleScale: { axisPressedMouseMove: true }
           });
      }
  };


  // --- Effects ---

  // Update Dynamic EMA Color
  useEffect(() => {
    if (emaSeriesRef.current) {
      emaSeriesRef.current.applyOptions({ color: emaColor });
    }
  }, [emaColor]);

  // Update Cursor Styles based on mode
  useEffect(() => {
      if(!mainChartRef.current || !mainChartContainerRef.current) return;
      
      const cursor = (isDrawingMode || isZoneMode) ? 'crosshair' : 'default';
      mainChartContainerRef.current.style.cursor = cursor;
      
      const crosshairMode = (isDrawingMode || isZoneMode) 
          // @ts-ignore
          ? window.LightweightCharts.CrosshairMode.Magnet 
          // @ts-ignore
          : window.LightweightCharts.CrosshairMode.Normal;

      mainChartRef.current.applyOptions({ crosshair: { mode: crosshairMode } });

  }, [isDrawingMode, isZoneMode]);


  // Data Update Effect
  useEffect(() => {
    if (!candleSeriesRef.current || !histogramSeriesRef.current || !emaSeriesRef.current) return;

    candleSeriesRef.current.setData(candles);
    emaSeriesRef.current.setData(emaData);

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

    // Force zone update when data changes (shifting timeline)
    requestAnimationFrame(updateZonePositions);

  }, [candles, macdData, emaData]);

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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Cancel drag if leaving
      >
        <div ref={mainChartContainerRef} className="w-full h-full relative z-0" />
        
        {/* HTML Overlay for Zones */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {renderedZones.map((z) => (
                z.style && (
                    <div 
                        key={z.id}
                        style={{
                            position: 'absolute',
                            top: z.style.top,
                            left: z.style.left,
                            width: z.style.width,
                            height: z.style.height,
                            backgroundColor: z.color,
                            border: '1px solid rgba(34, 197, 94, 0.5)',
                        }}
                    />
                )
            ))}
            {tempZoneStyle && (
                <div 
                    style={{
                        position: 'absolute',
                        top: tempZoneStyle.top,
                        left: tempZoneStyle.left,
                        width: tempZoneStyle.width,
                        height: tempZoneStyle.height,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.8)',
                    }}
                />
            )}
        </div>

        <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-emerald-400 border border-emerald-900 pointer-events-none shadow-lg">
          LIVE: {currentPrice.toFixed(2)}
        </div>
        {isDrawingMode && (
            <div className="absolute top-4 right-4 z-20 bg-amber-500/20 border border-amber-500 text-amber-400 px-3 py-1 rounded text-xs font-bold animate-pulse pointer-events-none">
                DRAWING MODE ACTIVE
            </div>
        )}
        {isZoneMode && (
            <div className="absolute top-4 right-4 z-20 bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-3 py-1 rounded text-xs font-bold animate-pulse pointer-events-none">
                ZONE TOOL ACTIVE
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
