import React, { useEffect, useRef, useState } from 'react';
import { ProChart } from './ProChart';
import { ErrorBoundary } from './ErrorBoundary';
import { TradeDetailsModal } from './TradeDetailsModal';
import { ToastNotification, ToastMessage } from './ToastNotification';
import { SimulatorViewProps } from './SimulatorView';
import { TV, PlayIcon, PauseIcon, GearIcon, PencilIcon, RefreshIcon, MenuIcon, XIcon, EyeIcon, EyeOffIcon, TBtn, Section, Param } from './tv/ui';
import { MacdDashboardPanel } from './tv/MacdDashboardPanel';
import { TradesPanel } from './tv/TradesPanel';
import { DaxParams, MacdData, MarketPreset, MARKET_PRESETS, Timeframe, TIMEFRAME_SECONDS, TradeType } from '../types';
import { formatBerlinTime } from '../services/daxEngine';

interface SimulatorViewV3Props extends SimulatorViewProps {
  macd4hData: MacdData[];
  simTime: number;
  prevSessionClose: number | null;
  daxParams: DaxParams;
  onDaxParamsChange: (p: DaxParams) => void;
}

const SYMBOL = 'GER40';
const SPREAD = MARKET_PRESETS[MarketPreset.DAX].spread;
const SHORTCUTS = [
  ['Space', 'Play / Pause'],
  ['A / S', 'Buy / Sell (Market)'],
  ['Q / W', 'Buy / Sell Limit at level'],
  ['X', 'Close Last Trade'],
  ['C', 'All SL to Breakeven'],
  ['D', 'Draw level'],
  ['Z', 'Remove Oldest Level'],
  ['1-0', 'Speed (20ms–1000ms)'],
];

const eur = (v: number) => `${v < 0 ? '-' : ''}€${Math.abs(v).toFixed(2)}`;

export function SimulatorViewV3(props: SimulatorViewV3Props) {
  const {
    candles, macdData, emaData, hma2Data, hmaData, rsiChartData, priceLines, trades, pnl, selectedTrade,
    config, macdSettings, emaPeriod, hma2Period, hmaPeriod, emaColor, hma2Color, hmaColor,
    isEma1Visible, isHma2Visible, isHmaVisible, slPoints, tpPoints, pipSize, pipValue,
    isPlaying, isBlindMode, isDrawingMode, currentSessionLabel, currentPrice, pricePrecision,
    onReturnToMenu, onReset, onTogglePlay, onToggleBlindMode, onToggleDrawingMode, onConfigChange,
    onMacdSettingsChange, onEmaPeriodChange, onHma2PeriodChange, onHmaPeriodChange,
    onEmaColorChange, onHma2ColorChange, onHmaColorChange, onEma1VisibleChange, onHma2VisibleChange, onHmaVisibleChange,
    onSlPointsChange, onTpPointsChange, onPipValueChange, onTrade, onCloseTrade, onSelectTrade, onChartClick, onRemoveLine,
    onDownloadCSV, currentAtr, atrPeriod, isAtrEnabled, onAtrPeriodChange, onAtrEnabledChange, sessionStats,
    timeframe, chartDataVersion, onTimeframeChange,
    macd4hData, simTime, prevSessionClose, daxParams, onDaxParamsChange,
  } = props;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const addToast = (type: ToastMessage['type'], text: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, text }]);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Toast when a position closes (TP / SL / manual)
  const prevTradesRef = useRef(trades);
  useEffect(() => {
    const prevTrades = prevTradesRef.current;
    trades.forEach(trade => {
      if (trade.status !== 'CLOSED') return;
      const prev = prevTrades.find(t => t.id === trade.id);
      if (!prev || prev.status === 'CLOSED') return;
      const pnlStr = `${(trade.pnl ?? 0) >= 0 ? '+' : ''}${eur(trade.pnl ?? 0)}`;
      if (trade.exitReason === 'TP') addToast('tp-hit', `✓ TP Hit ${pnlStr}`);
      else if (trade.exitReason === 'SL') addToast('sl-hit', `✗ SL Hit ${pnlStr}`);
      else addToast('manual-close', `Closed @ ${trade.closePrice?.toFixed(pricePrecision) ?? '—'} ${pnlStr}`);
    });
    prevTradesRef.current = trades;
  }, [trades]);

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const dayChange = prevSessionClose !== null ? currentPrice - prevSessionClose : 0;
  const dayChangePct = prevSessionClose ? (dayChange / prevSessionClose) * 100 : 0;
  const dayColor = dayChange >= 0 ? TV.green : TV.red;
  const bid = currentPrice - SPREAD / 2;
  const ask = currentPrice + SPREAD / 2;
  const atrEff = isAtrEnabled && currentAtr > 0 ? currentAtr : 0;
  const effSl = atrEff > 0 ? atrEff * 3 : slPoints;
  const effTp = atrEff > 0 ? atrEff * 6 : tpPoints;
  const pts = (v: number) => `${(v / pipSize).toFixed(1)} pts`;

  const trade = (type: TradeType) => {
    const entry = type === TradeType.LONG ? ask : bid;
    const dir = type === TradeType.LONG ? 1 : -1;
    onTrade(type);
    addToast('trade-open', `✓ ${type} @ ${entry.toFixed(pricePrecision)}${effSl > 0 ? ` | SL ${(entry - dir * effSl).toFixed(pricePrecision)}` : ''}${effTp > 0 ? ` | TP ${(entry + dir * effTp).toFixed(pricePrecision)}` : ''}`);
  };

  const chartData = { candles, emaData, hma2Data, hmaData, macdData, rsiChartData };

  return (
    <div className="h-screen flex flex-col select-none" style={{ background: TV.bg, color: TV.text }}>
      <TradeDetailsModal trade={selectedTrade} pricePrecision={pricePrecision} onClose={() => onSelectTrade(null)} />

      {/* ========== TOP BAR ========== */}
      <header className="h-12 flex items-center justify-between px-2 shrink-0 border-b gap-2" style={{ background: TV.panel, borderColor: TV.border }}>
        <div className="flex items-center gap-1 min-w-0">
          {/* Symbol + quote */}
          <div className="flex items-center gap-3 px-2">
            <div className={`w-2 h-2 rounded-full ${isPlaying ? 'animate-pulse' : ''}`} style={{ background: isPlaying ? TV.green : TV.textMuted }} />
            <div className="leading-tight">
              <div className="font-bold text-sm" style={{ color: TV.text }}>{SYMBOL}</div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: TV.textSec }}>DAX 40 · CFD · SIM</div>
            </div>
            <div className="leading-tight font-mono">
              <div className="text-sm font-bold" style={{ color: dayColor }}>{currentPrice.toLocaleString('en-US', { minimumFractionDigits: pricePrecision, maximumFractionDigits: pricePrecision })}</div>
              <div className="text-[10px]" style={{ color: dayColor }}>
                {prevSessionClose !== null ? `${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(pricePrecision)} (${dayChange >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%)` : '—'}
              </div>
            </div>
          </div>
          <div className="w-px h-6 mx-1" style={{ background: TV.border }} />

          {/* Timeframes */}
          <div className="flex items-center">
            {(Object.keys(TIMEFRAME_SECONDS) as Timeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded transition-colors"
                style={{ color: tf === timeframe ? TV.blue : TV.textSec, background: tf === timeframe ? '#2962ff22' : 'transparent' }}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="w-px h-6 mx-1" style={{ background: TV.border }} />

          <TBtn onClick={onTogglePlay} active={isPlaying} title="Space">{isPlaying ? <PauseIcon /> : <PlayIcon />}</TBtn>
          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px]" style={{ color: TV.textMuted }}>MS</span>
            <input
              type="number" min="20" max="5000" step="20"
              value={config.tickSpeedMs}
              onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) || 100 })}
              className="w-14 text-xs text-right font-mono px-1 py-0.5 rounded border outline-none"
              style={{ background: TV.bg, borderColor: TV.border, color: TV.text }}
            />
          </div>
          <TBtn onClick={() => { if (window.confirm('Reset simulation? A new month of history is generated and all trades are cleared.')) onReset(); }} title="New session"><RefreshIcon /></TBtn>
          <TBtn onClick={onToggleBlindMode} active={isBlindMode} title="Blind Mode — hide model parameters">BLIND</TBtn>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1">
          {([
            [isEma1Visible, emaColor, emaPeriod, onEma1VisibleChange],
            [isHma2Visible, hma2Color, hma2Period, onHma2VisibleChange],
            [isHmaVisible, hmaColor, hmaPeriod, onHmaVisibleChange],
          ] as const).map(([visible, color, period, toggle], idx) => (
            <TBtn key={idx} onClick={() => toggle(!visible)} active={visible} title={`Toggle EMA ${period}`}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: color }} />EMA {period}</span>
            </TBtn>
          ))}
          <TBtn onClick={() => onAtrEnabledChange(!isAtrEnabled)} active={isAtrEnabled} title="ATR-based SL/TP (3×SL, 6×TP)">
            <span className="flex items-center gap-1">ATR{isAtrEnabled && currentAtr > 0 && <span className="text-[9px] font-mono opacity-70">{currentAtr.toFixed(1)}</span>}</span>
          </TBtn>
          <TBtn onClick={onToggleDrawingMode} active={isDrawingMode} title="Draw level (D)">
            <span className="flex items-center gap-1"><PencilIcon />DRAW</span>
          </TBtn>
        </div>

        {/* Session, time, account */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ background: TV.bg, color: TV.text }}>{currentSessionLabel}</div>
          <div className="font-mono text-xs whitespace-nowrap" style={{ color: TV.green }}>{simTime > 0 ? formatBerlinTime(simTime, true) : '--:--'}</div>
          <div className="font-mono text-[11px] px-2 py-0.5 rounded" style={{ background: TV.bg, color: TV.textSec }}>Open: {openTrades.length}</div>
          <div className="font-mono text-xs font-bold px-2.5 py-1 rounded" style={{ background: pnl >= 0 ? '#08998118' : '#f2364518', color: pnl >= 0 ? TV.green : TV.red }}>{eur(pnl)}</div>
          <div className="relative">
            <TBtn onClick={() => setShowShortcuts(!showShortcuts)} title="Keyboard Shortcuts">?</TBtn>
            {showShortcuts && (
              <div className="absolute right-0 top-10 z-50 rounded-lg shadow-2xl p-4 text-xs w-60 border" style={{ background: TV.panel, borderColor: TV.border }}>
                <div className="font-bold mb-2" style={{ color: TV.text }}>Keyboard Shortcuts</div>
                {SHORTCUTS.map(([key, desc]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: TV.bg, color: TV.text }}>{key}</kbd>
                    <span style={{ color: TV.textSec }}>{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <TBtn onClick={() => setIsSettingsOpen(!isSettingsOpen)} active={isSettingsOpen} title="Settings"><GearIcon /></TBtn>
          <TBtn onClick={onReturnToMenu} title="Change Sim"><MenuIcon /></TBtn>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 min-w-0">
          <ErrorBoundary>
            <ProChart
              data={chartData}
              macd4h={macd4hData}
              timeframe={timeframe}
              dataVersion={chartDataVersion}
              simTime={simTime}
              trades={trades}
              priceLines={priceLines}
              isDrawingMode={isDrawingMode}
              isEma1Visible={isEma1Visible}
              isHma2Visible={isHma2Visible}
              isHmaVisible={isHmaVisible}
              emaColor={emaColor}
              hma2Color={hma2Color}
              hmaColor={hmaColor}
              emaPeriod={emaPeriod}
              hma2Period={hma2Period}
              hmaPeriod={hmaPeriod}
              macdConfig={macdSettings}
              pricePrecision={pricePrecision}
              pipSize={pipSize}
              symbol={SYMBOL}
              onChartClick={onChartClick}
            />
          </ErrorBoundary>
        </div>

        {/* ========== SETTINGS DRAWER ========== */}
        <div
          className="shrink-0 overflow-y-auto overflow-x-hidden border-l"
          style={{
            width: isSettingsOpen ? '300px' : '0px',
            borderColor: TV.border,
            background: TV.panel,
            opacity: isSettingsOpen ? 1 : 0,
            pointerEvents: isSettingsOpen ? 'auto' : 'none',
            transition: 'width 200ms ease, opacity 200ms ease',
          }}
        >
          <div className="p-4 w-[300px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TV.textSec }}>Settings</span>
              <button onClick={() => setIsSettingsOpen(false)} style={{ color: TV.textSec }} className="hover:text-white"><XIcon /></button>
            </div>

            <Section title="Market Model — GER40">
              <div className="space-y-3">
                {([
                  ['dailyVolPct', 'Daily volatility', 0.5, 3, 0.1, (v: number) => `${v.toFixed(1)}%`],
                  ['trendiness', 'Trend days vs range days', 0, 1, 0.05, (v: number) => v.toFixed(2)],
                  ['newsIntensity', 'US data / NY open impact', 0, 1, 0.05, (v: number) => v.toFixed(2)],
                ] as const).map(([key, label, min, max, step, show]) => (
                  <Param key={key} label={label} blind={isBlindMode}>
                    <input type="range" min={min} max={max} step={step} value={daxParams[key]}
                      onChange={(e) => onDaxParamsChange({ ...daxParams, [key]: parseFloat(e.target.value) })}
                      className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.blue }} />
                    {!isBlindMode && <span className="text-[11px] font-mono" style={{ color: TV.blue }}>{show(daxParams[key])}</span>}
                  </Param>
                ))}
                <Param label="Tick Speed">
                  <input type="range" min="20" max="5000" step="20" value={config.tickSpeedMs}
                    onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) })}
                    className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.blue }} />
                  <span className="text-[11px] font-mono" style={{ color: TV.textSec }}>{config.tickSpeedMs}ms per 1m candle</span>
                </Param>
              </div>
            </Section>

            <Section title="Indicators">
              <div className="space-y-3">
                {([
                  ['EMA 1', isEma1Visible, onEma1VisibleChange, emaColor, onEmaColorChange, emaPeriod, onEmaPeriodChange],
                  ['EMA 2', isHma2Visible, onHma2VisibleChange, hma2Color, onHma2ColorChange, hma2Period, onHma2PeriodChange],
                  ['EMA 3', isHmaVisible, onHmaVisibleChange, hmaColor, onHmaColorChange, hmaPeriod, onHmaPeriodChange],
                ] as const).map(([label, visible, onVisible, color, onColor, period, onPeriod]) => (
                  <div key={label} className="flex items-center gap-2">
                    <button onClick={() => onVisible(!visible)} style={{ color: TV.textMuted }}>{visible ? <EyeIcon /> : <EyeOffIcon />}</button>
                    <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>{label}</span>
                    <input type="color" value={color} onChange={(e) => onColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                    <input type="number" min="2" max="300" value={period} onChange={(e) => onPeriod(parseInt(e.target.value) || 1)}
                      className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color }} />
                  </div>
                ))}
                <div className="pt-2 border-t" style={{ borderColor: TV.border }}>
                  <span className="text-[11px] block mb-2" style={{ color: TV.textSec }}>MACD (timeframe + 4h)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['fast', 'slow', 'signal'] as const).map(key => (
                      <div key={key}>
                        <span className="text-[10px] block mb-0.5" style={{ color: TV.textMuted }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        <input type="number" min="1" value={macdSettings[key]}
                          onChange={(e) => onMacdSettingsChange({ ...macdSettings, [key]: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full text-xs px-2 py-1 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: TV.text }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t" style={{ borderColor: TV.border }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onAtrEnabledChange(!isAtrEnabled)} style={{ color: isAtrEnabled ? '#f97316' : TV.textMuted }}>{isAtrEnabled ? <EyeIcon /> : <EyeOffIcon />}</button>
                    <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>ATR (1m) for SL/TP</span>
                    <input type="number" min="2" max="50" value={atrPeriod} onChange={(e) => onAtrPeriodChange(parseInt(e.target.value) || 14)}
                      className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: '#f97316' }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px]">
                    <span style={{ color: TV.textMuted }}>Current ATR</span>
                    <span className="font-mono" style={{ color: '#f97316' }}>{currentAtr > 0 ? pts(currentAtr) : '—'}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Execution">
              <div className="space-y-3">
                {isAtrEnabled && (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ background: '#f9731618', color: '#f97316', border: '1px solid #f9731633' }}>
                    ATR mode — SL 3×ATR, TP 6×ATR (market orders)
                  </div>
                )}
                <div className={`grid grid-cols-2 gap-2 ${isAtrEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Stop Loss (pts)</span>
                    <input type="number" min="0" step="1" value={slPoints} onChange={(e) => onSlPointsChange(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.red + '44', color: TV.red }} />
                  </div>
                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Take Profit (pts)</span>
                    <input type="number" min="0" step="1" value={tpPoints} onChange={(e) => onTpPointsChange(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.green + '44', color: TV.green }} />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Point value (€/pt — 1 = one CFD contract)</span>
                  <input type="number" min="0.1" step="0.1" value={pipValue} onChange={(e) => onPipValueChange(parseFloat(e.target.value) || 0.1)}
                    className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.blue + '44', color: TV.blue }} />
                </div>
              </div>
            </Section>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR: dashboard + order panel ========== */}
        <div className="shrink-0 border-l flex flex-col" style={{ width: '230px', borderColor: TV.border, background: '#0a0a1a' }}>
          {props.macdDashboard && <MacdDashboardPanel data={props.macdDashboard} precision={2} />}
          <div className="flex-1" />

          <div className="flex flex-col gap-2 p-2" style={{ background: TV.panel, borderTop: `1px solid ${TV.border}` }}>
            <div className="flex justify-between text-[10px] uppercase tracking-wider" style={{ color: TV.textMuted }}>
              <span>Market · 1 contract</span>
              <span>{eur(pipValue)}/pt</span>
            </div>

            {/* SELL bid | spread | BUY ask */}
            <div className="flex items-stretch gap-1">
              <button onClick={() => trade(TradeType.SHORT)} className="flex-1 rounded py-1.5 text-white transition-all active:scale-95 hover:brightness-110" style={{ background: TV.red }}>
                <div className="text-[10px] font-semibold opacity-80">SELL <span className="opacity-60">(S)</span></div>
                <div className="font-mono text-sm font-bold">{bid.toFixed(pricePrecision)}</div>
              </button>
              <div className="flex items-center text-[9px] font-mono px-0.5" style={{ color: TV.textSec }}>{SPREAD.toFixed(1)}</div>
              <button onClick={() => trade(TradeType.LONG)} className="flex-1 rounded py-1.5 text-white transition-all active:scale-95 hover:brightness-110" style={{ background: TV.blue }}>
                <div className="text-[10px] font-semibold opacity-80">BUY <span className="opacity-60">(A)</span></div>
                <div className="font-mono text-sm font-bold">{ask.toFixed(pricePrecision)}</div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <div className="rounded px-1.5 py-1" style={{ background: TV.bg }}>
                <div style={{ color: TV.textMuted }}>SL{atrEff > 0 ? ' 3×ATR' : ''}</div>
                <div style={{ color: TV.red }}>{effSl > 0 ? `${pts(effSl)} · ${eur(effSl / pipSize * pipValue)}` : '—'}</div>
              </div>
              <div className="rounded px-1.5 py-1" style={{ background: TV.bg }}>
                <div style={{ color: TV.textMuted }}>TP{atrEff > 0 ? ' 6×ATR' : ''}</div>
                <div style={{ color: TV.green }}>{effTp > 0 ? `${pts(effTp)} · ${eur(effTp / pipSize * pipValue)}` : '—'}</div>
              </div>
            </div>

            {priceLines.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {priceLines.map((price, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: '#f472b622', color: '#f472b6', border: '1px solid #f472b644' }}>
                    {price.toFixed(pricePrecision)}
                    <button onClick={() => onRemoveLine(idx)} className="hover:text-white">x</button>
                  </div>
                ))}
                <div className="w-full text-[9px]" style={{ color: TV.textMuted }}>Q / W: buy / sell limit at the last level</div>
              </div>
            ) : (
              <div className="text-[9px] text-center" style={{ color: TV.textMuted }}>D: draw a level · Q / W: limit order at it</div>
            )}
          </div>
        </div>
      </div>

      <ToastNotification messages={toasts} onDismiss={dismissToast} />

      <TradesPanel
        trades={trades}
        currentPrice={currentPrice}
        pipSize={pipSize}
        pipValue={pipValue}
        pricePrecision={pricePrecision}
        sessionStats={sessionStats}
        currency="€"
        unitLabel="Points"
        onSelectTrade={onSelectTrade}
        onCloseTrade={onCloseTrade}
        onDownloadCSV={onDownloadCSV}
      />
    </div>
  );
}
