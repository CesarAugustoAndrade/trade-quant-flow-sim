import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FinancialChart } from './FinancialChart';
import { ErrorBoundary } from './ErrorBoundary';
import { TradeDetailsModal } from './TradeDetailsModal';
import { SimulatorViewProps } from './SimulatorView';
import { TradeType, SimulationType, MacdDashboardData } from '../types';
import { ToastNotification, ToastMessage } from './ToastNotification';

// --- TradingView Color Palette ---
const TV = {
  bg: '#131722',
  panel: '#1e222d',
  panelHover: '#2a2e39',
  border: '#363a45',
  text: '#d1d4dc',
  textSec: '#787b86',
  textMuted: '#4c525e',
  green: '#089981',
  red: '#f23645',
  blue: '#2962ff',
};

// --- Compact SVG Icons ---
const PlayIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const PauseIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const GearIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const PencilIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>;
const RefreshIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const MenuIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const ChevronDown = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const ChevronUp = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const DownloadIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const ClipboardIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const SIM_MODEL_LABELS: Record<SimulationType, string> = {
  [SimulationType.GBM]: 'GBM Stochastic',
  [SimulationType.MOMENTUM]: 'Autocorrelation',
  [SimulationType.OU]: 'Ornstein-Uhlenbeck',
  [SimulationType.GARCH]: 'GARCH(1,1)',
};

// --- Toolbar Button ---
function TBtn({ active, onClick, children, title, className = '' }: { active?: boolean; onClick?: () => void; children: React.ReactNode; title?: string; className?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`px-2.5 py-1.5 text-xs rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${active ? 'text-[#2962ff]' : ''} ${className}`}
      style={{
        background: active ? '#2962ff33' : hovered ? TV.panelHover : 'transparent',
        color: active ? '#2962ff' : hovered ? TV.text : TV.textSec,
      }}
    >
      {children}
    </button>
  );
}

function DashRow({ label, children, lbl, row, txtL }: { label: string; children: React.ReactNode; lbl: string; row: string; txtL: string }) {
  return (
    <div className="flex items-center" style={{ borderBottom: '1px solid #ffffff08' }}>
      <div className="flex-1 px-2 py-1 text-[9px] truncate" style={{ background: lbl, color: txtL }}>{label}</div>
      <div className="px-2 py-1 text-right text-[10px]" style={{ background: row, minWidth: '80px' }}>{children}</div>
    </div>
  );
}

function MacdDashboardPanel({ data }: { data: MacdDashboardData }) {
  const hdr = '#0f3460';
  const lbl = '#1a1a2e';
  const row = '#16213e';
  const txtL = '#8899aa';
  const g = '#089981';
  const r = '#f23645';
  return (
    <div className="flex flex-col text-[10px] font-mono" style={{ background: '#0a0a1a' }}>
      {/* Header */}
      <div className="px-2 py-1 text-center font-bold tracking-wider" style={{ background: hdr, color: '#fff', fontSize: '9px' }}>
        MACD DASHBOARD <span style={{ color: '#8899aa', fontWeight: 'normal' }}>{data.macdParams.fast}/{data.macdParams.slow}/{data.macdParams.signal}</span>
      </div>

      {/* Rows */}
      <DashRow label={`1H EMA ${data.ema1hParams.fast}/${data.ema1hParams.slow}`} lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.ema1hTrend === 'BULLISH' ? g : r }}>{data.ema1hTrend}</span>
      </DashRow>
      <DashRow label="MACD vs Zero" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.macdVsZero >= 0 ? g : r }}>{data.macdVsZero.toFixed(4)}</span>
      </DashRow>
      <DashRow label="MACD vs Signal" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.macdVsSignal >= 0 ? g : r }}>{data.macdVsSignal.toFixed(4)}</span>
      </DashRow>
      <DashRow label="Histogram" lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.histogramRising ? g : r }}>{data.histogramRising ? '\u25b2 CRESCENT' : '\u25bc DECRESCENT'}</span>
      </DashRow>
      <DashRow label="Divergence" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.divergence === 'None' ? '#666' : data.divergence.includes('BULL') ? g : r }}>{data.divergence}</span>
      </DashRow>
      <DashRow label={`ATR (${data.atrPeriod})`} lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: '#00d2ff' }}>{data.atr.toFixed(5)}</span>
      </DashRow>

      {/* Drift Score — compact */}
      <div className="flex items-center justify-between px-2 py-1.5" style={{ background: hdr, borderTop: '1px solid #363a45' }}>
        <span className="text-[9px] uppercase" style={{ color: '#8899aa' }}>DRIFT</span>
        <span className="font-bold" style={{ color: data.driftColor, fontSize: '11px' }}>{data.driftLabel} {data.driftPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function SimulatorViewV2(props: SimulatorViewProps) {
  const {
    candles, macdData, emaData, hma2Data, hmaData, hmaBandData, priceLines, trades, pnl, selectedTrade,
    config, macdSettings, emaPeriod, hma2Period, hmaPeriod, emaColor, hma2Color, hmaColor,
    isEma1Visible, isHma2Visible, isHmaVisible, isMacdVisible, slPoints, tpPoints, pipSize, pipValue,
    isPlaying, isAutoMode, isBlindMode, isDrawingMode, currentSessionLabel,
    selectedSim, momentumParams, ouParams, garchParams, currentGarchSigma,
    currentPrice, currentTimeDisplay, pricePrecision,
    onReturnToMenu, onReset, onTogglePlay, onToggleAutoMode, onToggleBlindMode, onToggleDrawingMode,
    onConfigChange, onMacdSettingsChange, onEmaPeriodChange, onHma2PeriodChange, onHmaPeriodChange,
    onEmaColorChange, onHma2ColorChange, onHmaColorChange,
    onEma1VisibleChange, onHma2VisibleChange, onHmaVisibleChange, onMacdVisibleChange,
    onSlPointsChange, onTpPointsChange, onPipValueChange,
    onTrade, onCloseTrade, onSelectTrade, onChartClick, onRemoveLine, onDownloadCSV,
    onMomentumParamsChange, onOuParamsChange, onGarchParamsChange,
    currentAtr, atrPeriod, isAtrEnabled, onAtrPeriodChange, onAtrEnabledChange,
    sessionStats,
  } = props;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'journal'>('positions');
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);


  const addToast = (type: ToastMessage['type'], text: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, text }]);
  };

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Track closed trades to fire toast on auto-close
  const prevTradesRef = useRef(trades);
  useEffect(() => {
    const prevTrades = prevTradesRef.current;
    trades.forEach(trade => {
      if (trade.status === 'CLOSED') {
        const prev = prevTrades.find(t => t.id === trade.id);
        if (prev && prev.status !== 'CLOSED') {
          const pnl = trade.pnl ?? 0;
          const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
          if (trade.exitReason === 'TP') addToast('tp-hit', `\u2713 TP Hit ${pnlStr}`);
          else if (trade.exitReason === 'SL') addToast('sl-hit', `\u2717 SL Hit ${pnlStr}`);
          else addToast('manual-close', `Closed @ ${trade.closePrice?.toFixed(pricePrecision) ?? '—'} ${pnlStr}`);
        }
      }
    });
    prevTradesRef.current = trades;
  }, [trades]);



  const openTrades = trades.filter(t => t.status === 'OPEN');
  const pendingTrades = trades.filter(t => t.status === 'PENDING');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const filteredTrades = activeTab === 'positions' ? openTrades : activeTab === 'orders' ? pendingTrades : activeTab === 'history' ? closedTrades : [];
  const garchAB = garchParams.alpha + garchParams.beta;

  return (
    <div className="h-screen flex flex-col select-none" style={{ background: TV.bg, color: TV.text }}>
      <TradeDetailsModal trade={selectedTrade} pricePrecision={pricePrecision} onClose={() => onSelectTrade(null)} />

      {/* ========== TOP TOOLBAR ========== */}
      <header className="h-11 flex items-center justify-between px-2 shrink-0 border-b" style={{ background: TV.panel, borderColor: TV.border }}>
        {/* Left cluster */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 px-2 py-1 rounded font-bold text-sm" style={{ color: '#8b5cf6' }}>
            <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#089981] animate-pulse' : ''}`} style={!isPlaying ? { background: TV.textMuted } : undefined} />
            EUR/USD v2
          </div>
          <div className="w-px h-5 mx-1" style={{ background: TV.border }} />

          {/* Play/Pause */}
          <TBtn onClick={onTogglePlay} active={isPlaying} title="Space">
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </TBtn>

          {/* Speed */}
          <div className="flex items-center gap-1 px-2">
            <span className="text-[10px]" style={{ color: TV.textMuted }}>SPD</span>
            <input
              type="number" min="20" max="5000" step="20"
              value={config.tickSpeedMs}
              onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) || 100 })}
              className="w-14 text-xs text-right font-mono px-1 py-0.5 rounded border outline-none"
              style={{ background: TV.bg, borderColor: TV.border, color: TV.text }}
            />
          </div>

          {/* Reset */}
          <TBtn onClick={() => { if (window.confirm('Reset simulation? All trades will be cleared.')) onReset(); }} title="Reset Simulation"><RefreshIcon /></TBtn>

          <div className="w-px h-5 mx-1" style={{ background: TV.border }} />

          {/* Modes */}
          {selectedSim === SimulationType.GBM && (
            <TBtn onClick={onToggleAutoMode} active={isAutoMode} title="Real Trading Day">
              {isAutoMode ? currentSessionLabel : 'AUTO'}
            </TBtn>
          )}
          <TBtn onClick={onToggleBlindMode} active={isBlindMode} title="Blind Mode">BLIND</TBtn>
        </div>

        {/* Center cluster - Indicators */}
        <div className="flex items-center gap-1">
          <TBtn onClick={() => onEma1VisibleChange(!isEma1Visible)} active={isEma1Visible} title="Toggle EMA">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: emaColor }} />EMA</span>
          </TBtn>
          <TBtn onClick={() => onHma2VisibleChange(!isHma2Visible)} active={isHma2Visible} title="Toggle HMA 2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: hma2Color }} />HMA2</span>
          </TBtn>
          <TBtn onClick={() => onHmaVisibleChange(!isHmaVisible)} active={isHmaVisible} title="Toggle HMA">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: hmaColor }} />HMA</span>
          </TBtn>
          <TBtn onClick={() => onMacdVisibleChange(!isMacdVisible)} active={isMacdVisible} title="Toggle MACD">MACD</TBtn>
          <TBtn onClick={() => onAtrEnabledChange(!isAtrEnabled)} active={isAtrEnabled} title="ATR-based SL/TP (1.5×SL, 3×TP)">
            <span className="flex items-center gap-1">
              ATR
              {isAtrEnabled && currentAtr > 0 && (
                <>
                  <span className="text-[9px] font-mono opacity-70">{currentAtr.toFixed(5)}</span>
                  <span className="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse ml-1" />
                </>
              )}
            </span>
          </TBtn>

          <div className="w-px h-5 mx-1" style={{ background: TV.border }} />

          <TBtn onClick={onToggleDrawingMode} active={isDrawingMode} title="Draw Lines (D)">
            <span className="flex items-center gap-1"><PencilIcon />{isDrawingMode ? 'DRAWING' : 'DRAW'}</span>
          </TBtn>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {/* Time */}
          <div className="font-mono text-xs px-2" style={{ color: TV.green }}>{currentTimeDisplay}</div>

          {/* Open positions count */}
          <div className="font-mono text-[11px] px-2 py-0.5 rounded" style={{ background: TV.bg, color: TV.textSec }}>
            Open: {openTrades.length}
          </div>

          {/* PnL */}
          <div className="font-mono text-xs font-bold px-2.5 py-1 rounded" style={{ background: pnl >= 0 ? '#08998118' : '#f2364518', color: pnl >= 0 ? TV.green : TV.red, transition: 'color 300ms ease-in-out, background 300ms ease-in-out' }}>
            ${pnl.toFixed(2)}
          </div>

          <div className="w-px h-5 mx-1" style={{ background: TV.border }} />

          {/* Shortcuts help */}
          <div className="relative">
            <TBtn onClick={() => setShowShortcuts(!showShortcuts)} title="Keyboard Shortcuts">?</TBtn>
            {showShortcuts && (
              <div className="absolute right-0 top-10 z-50 rounded-lg shadow-2xl p-4 text-xs w-56 border" style={{ background: TV.panel, borderColor: TV.border }}>
                <div className="font-bold mb-2" style={{ color: TV.text }}>Keyboard Shortcuts</div>
                {[
                  ['Space', 'Play / Pause'],
                  ['A', 'Buy (Market)'],
                  ['S', 'Sell (Market)'],
                  ['Q', 'Buy Limit'],
                  ['W', 'Sell Limit'],
                  ['X', 'Close Last Trade'],
                  ['C', 'All SL to Breakeven'],
                  ['D', 'Toggle Drawing'],
                  ['Z', 'Remove Oldest Line'],
                  ['1-0', 'Speed (20ms–1000ms)'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: TV.bg, color: TV.text }}>{key}</kbd>
                    <span style={{ color: TV.textSec }}>{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settings gear */}
          <TBtn onClick={() => setIsSettingsOpen(!isSettingsOpen)} active={isSettingsOpen} title="Settings"><GearIcon /></TBtn>

          {/* Back to menu */}
          <TBtn onClick={onReturnToMenu} title="Change Sim"><MenuIcon /></TBtn>
        </div>
      </header>

      {/* ========== MAIN AREA (chart + optional settings drawer) ========== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chart */}
        <div className="flex-1 flex flex-col relative min-w-0">
          {/* Compact session stats bar */}
          {(() => {
            const { winRate, avgRR, profitFactor } = sessionStats;
            const closed = trades.filter(t => t.status === 'CLOSED');
            const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
            const losses = closed.length - wins;
            if (closed.length === 0) return null;
            return (
              <div className="flex items-center gap-3 px-3 py-0.5 text-[10px] font-mono border-b border-white/5" style={{ background: TV.bg, color: '#888' }}>
                <span>{wins}W / {losses}L</span>
                <span style={{ color: winRate >= 0.5 ? '#089981' : '#f23645' }}>Win: {(winRate * 100).toFixed(0)}%</span>
                <span>Avg RR: {avgRR.toFixed(1)}</span>
                <span style={{ color: profitFactor >= 1 ? '#089981' : '#f23645' }}>PF: {profitFactor.toFixed(2)}</span>
              </div>
            );
          })()}
          <div className={`flex-1 ${isBottomCollapsed ? '' : ''}`}>
            <ErrorBoundary>
              <FinancialChart
                candles={candles}
                macdData={macdData}
                currentPrice={currentPrice}
                priceLines={priceLines}
                emaData={emaData}
                hma2Data={hma2Data}
                hmaData={hmaData}
                hmaBandData={hmaBandData}
                trades={trades}
                isDrawingMode={isDrawingMode}
                macdConfig={macdSettings}
                emaColor={emaColor}
                hma2Color={hma2Color}
                hmaColor={hmaColor}
                isEma1Visible={isEma1Visible}
                isHma2Visible={isHma2Visible}
                isHmaVisible={isHmaVisible}
                isMacdVisible={isMacdVisible}
                pricePrecision={pricePrecision}
                onChartClick={onChartClick}
              />
            </ErrorBoundary>
          </div>


          {/* Drawing mode active indicator */}
          {isDrawingMode && (
            <div className="absolute top-3 right-3 z-20 text-[11px] font-bold px-3 py-1.5 rounded animate-pulse" style={{ background: '#f59e0b33', color: '#f59e0b', border: '1px solid #f59e0b55' }}>
              DRAW MODE — Click chart to place line
            </div>
          )}

          {/* Model label */}
          <div className="absolute bottom-4 left-4 z-10 text-[10px] font-mono px-2 py-1 rounded" style={{ background: TV.panel + 'cc', color: TV.textMuted }}>
            {SIM_MODEL_LABELS[selectedSim]}
          </div>
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
            transitionDelay: '0ms, 150ms',
          }}
        >
          <div className="p-4 w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TV.textSec }}>Settings</span>
              <button onClick={() => setIsSettingsOpen(false)} style={{ color: TV.textSec }} className="hover:text-white"><XIcon /></button>
            </div>

            {/* --- Engine Params --- */}
            <Section title="Engine Parameters">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: TV.textMuted }}>{SIM_MODEL_LABELS[selectedSim]}</div>

                {/* GBM */}
                {selectedSim === SimulationType.GBM && (
                  <>
                    <Param label="Volatility (sigma)" disabled={isAutoMode} blind={isBlindMode}>
                      <input type="range" min="0.0005" max="0.01" step="0.0001" value={config.volatility} disabled={isAutoMode}
                        onChange={(e) => onConfigChange({ ...config, volatility: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.blue }} />
                      {!isBlindMode && <span className="text-[11px] font-mono" style={{ color: TV.blue }}>{(config.volatility * 100).toFixed(3)}%</span>}
                    </Param>
                    <Param label="Drift (mu)" disabled={isAutoMode} blind={isBlindMode}>
                      <input type="range" min="-0.002" max="0.002" step="0.0001" value={config.drift} disabled={isAutoMode}
                        onChange={(e) => onConfigChange({ ...config, drift: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.blue }} />
                      {!isBlindMode && <span className="text-[11px] font-mono" style={{ color: config.drift >= 0 ? TV.green : TV.red }}>{config.drift.toFixed(5)}</span>}
                    </Param>
                  </>
                )}

                {/* Momentum */}
                {selectedSim === SimulationType.MOMENTUM && (
                  <>
                    <Param label="Volatility (sigma)">
                      <input type="range" min="0.0005" max="0.01" step="0.0001" value={momentumParams.volatility}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, volatility: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.green }} />
                      <span className="text-[11px] font-mono" style={{ color: TV.green }}>{(momentumParams.volatility * 100).toFixed(3)}%</span>
                    </Param>
                    <Param label="Trend Strength">
                      <input type="range" min="0" max="0.95" step="0.05" value={momentumParams.trendStrength}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, trendStrength: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.green }} />
                      <span className="text-[11px] font-mono" style={{ color: TV.green }}>{momentumParams.trendStrength.toFixed(2)}</span>
                    </Param>
                    <Param label="Drift (mu)">
                      <input type="range" min="-0.002" max="0.002" step="0.0001" value={momentumParams.drift}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, drift: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.green }} />
                      <span className="text-[11px] font-mono" style={{ color: momentumParams.drift >= 0 ? TV.green : TV.red }}>{momentumParams.drift.toFixed(5)}</span>
                    </Param>
                  </>
                )}

                {/* OU */}
                {selectedSim === SimulationType.OU && (
                  <>
                    <Param label="Mean Level (mu)">
                      <input type="number" step="1" value={ouParams.meanLevel}
                        onChange={(e) => onOuParamsChange({ ...ouParams, meanLevel: parseFloat(e.target.value) || ouParams.meanLevel })}
                        className="w-full text-xs font-mono px-2 py-1 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: '#f59e0b' }} />
                    </Param>
                    <Param label="Reversion Speed (theta)">
                      <input type="range" min="0.001" max="0.1" step="0.001" value={ouParams.reversionSpeed}
                        onChange={(e) => onOuParamsChange({ ...ouParams, reversionSpeed: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: '#f59e0b' }} />
                      <span className="text-[11px] font-mono" style={{ color: '#f59e0b' }}>{ouParams.reversionSpeed.toFixed(4)} (t1/2~{Math.round(Math.log(2) / ouParams.reversionSpeed)})</span>
                    </Param>
                    <Param label="Noise sigma">
                      <input type="range" min="0.1" max="10" step="0.1" value={ouParams.volatility}
                        onChange={(e) => onOuParamsChange({ ...ouParams, volatility: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: '#f59e0b' }} />
                      <span className="text-[11px] font-mono" style={{ color: '#f59e0b' }}>{ouParams.volatility.toFixed(2)}</span>
                    </Param>
                  </>
                )}

                {/* GARCH */}
                {selectedSim === SimulationType.GARCH && (
                  <>
                    <Param label="Alpha (a)">
                      <input type="range" min="0.01" max="0.5" step="0.01" value={garchParams.alpha}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, alpha: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: '#f43f5e' }} />
                      <span className="text-[11px] font-mono" style={{ color: '#f43f5e' }}>{garchParams.alpha.toFixed(2)}</span>
                    </Param>
                    <Param label="Beta (b)">
                      <input type="range" min="0.1" max="0.95" step="0.01" value={garchParams.beta}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, beta: parseFloat(e.target.value) })}
                        className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: '#f43f5e' }} />
                      <span className="text-[11px] font-mono" style={{ color: '#f43f5e' }}>{garchParams.beta.toFixed(2)}</span>
                    </Param>
                    {garchAB > 0.98 && (
                      <div className="text-[10px] px-2 py-1 rounded" style={{ background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b33' }}>
                        a+b={garchAB.toFixed(2)} — near non-stationarity
                      </div>
                    )}
                    <Param label="Omega (w)">
                      <input type="number" step="0.0000001" value={garchParams.omega}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, omega: parseFloat(e.target.value) || garchParams.omega })}
                        className="w-full text-xs font-mono px-2 py-1 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: '#f43f5e' }} />
                    </Param>
                    <Param label="Drift (mu)">
                      <input type="number" step="0.00001" value={parseFloat(garchParams.drift.toFixed(5))}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, drift: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs font-mono px-2 py-1 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: garchParams.drift >= 0 ? TV.green : TV.red }} />
                    </Param>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: TV.textMuted }}>Current sigma</span>
                      <span className="font-mono" style={{ color: '#f43f5e' }}>{(currentGarchSigma * 100).toFixed(4)}%</span>
                    </div>
                  </>
                )}

                {/* Speed slider */}
                <Param label="Tick Speed">
                  <input type="range" min="20" max="5000" step="20" value={config.tickSpeedMs}
                    onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) })}
                    className="w-full h-1 rounded appearance-none cursor-pointer" style={{ accentColor: TV.blue }} />
                  <span className="text-[11px] font-mono" style={{ color: TV.textSec }}>{config.tickSpeedMs}ms</span>
                </Param>
              </div>
            </Section>

            {/* --- Indicator Settings --- */}
            <Section title="Indicators">
              <div className="space-y-3">
                {/* EMA */}
                <div className="flex items-center gap-2">
                  <button onClick={() => onEma1VisibleChange(!isEma1Visible)} style={{ color: TV.textMuted }}>{isEma1Visible ? <EyeIcon /> : <EyeOffIcon />}</button>
                  <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>EMA 1</span>
                  <input type="color" value={emaColor} onChange={(e) => onEmaColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                  <input type="number" min="5" max="200" value={emaPeriod} onChange={(e) => onEmaPeriodChange(parseInt(e.target.value) || 1)}
                    className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: emaColor }} />
                </div>
                {/* HMA 2 */}
                <div className="flex items-center gap-2">
                  <button onClick={() => onHma2VisibleChange(!isHma2Visible)} style={{ color: TV.textMuted }}>{isHma2Visible ? <EyeIcon /> : <EyeOffIcon />}</button>
                  <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>HMA 2</span>
                  <input type="color" value={hma2Color} onChange={(e) => onHma2ColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                  <input type="number" min="5" max="200" value={hma2Period} onChange={(e) => onHma2PeriodChange(parseInt(e.target.value) || 1)}
                    className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: hma2Color }} />
                </div>
                {/* HMA */}
                <div className="flex items-center gap-2">
                  <button onClick={() => onHmaVisibleChange(!isHmaVisible)} style={{ color: TV.textMuted }}>{isHmaVisible ? <EyeIcon /> : <EyeOffIcon />}</button>
                  <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>HMA</span>
                  <input type="color" value={hmaColor} onChange={(e) => onHmaColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                  <input type="number" min="5" max="300" value={hmaPeriod} onChange={(e) => onHmaPeriodChange(parseInt(e.target.value) || 1)}
                    className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.border, color: hmaColor }} />
                </div>
                {/* MACD */}
                <div className="pt-2 border-t" style={{ borderColor: TV.border }}>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => onMacdVisibleChange(!isMacdVisible)} style={{ color: TV.textMuted }}>{isMacdVisible ? <EyeIcon /> : <EyeOffIcon />}</button>
                    <span className="text-[11px]" style={{ color: TV.textSec }}>MACD ({macdSettings.fast}, {macdSettings.slow}, {macdSettings.signal})</span>
                  </div>
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

                {/* ATR */}
                <div className="pt-2 border-t" style={{ borderColor: TV.border }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onAtrEnabledChange(!isAtrEnabled)} style={{ color: isAtrEnabled ? '#f97316' : TV.textMuted }}>
                      {isAtrEnabled ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    <span className="text-[11px] flex-1" style={{ color: TV.textSec }}>ATR</span>
                    <input type="number" min="2" max="50" value={atrPeriod}
                      onChange={(e) => onAtrPeriodChange(parseInt(e.target.value) || 14)}
                      className="w-12 text-xs font-mono text-right px-1 py-0.5 rounded border outline-none"
                      style={{ background: TV.bg, borderColor: TV.border, color: '#f97316' }} />
                  </div>
                  <div className="mt-1.5 flex justify-between items-center">
                    <span className="text-[10px]" style={{ color: TV.textMuted }}>Current ATR</span>
                    <span className="text-[11px] font-mono" style={{ color: '#f97316' }}>
                      {currentAtr > 0 ? `${currentAtr.toFixed(5)} (${(currentAtr / 0.001).toFixed(1)} pips)` : '—'}
                    </span>
                  </div>
                  {isAtrEnabled && currentAtr > 0 && (
                    <div className="mt-1 space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span style={{ color: TV.textMuted }}>SL (1.5×ATR)</span>
                        <span className="font-mono" style={{ color: TV.red }}>{(currentAtr * 1.5).toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: TV.textMuted }}>TP (3×ATR)</span>
                        <span className="font-mono" style={{ color: TV.green }}>{(currentAtr * 3).toFixed(5)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* --- Execution Config --- */}
            <Section title="Execution">
              <div className="space-y-3">
                {isAtrEnabled && (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ background: '#f9731618', color: '#f97316', border: '1px solid #f9731633' }}>
                    ATR mode active — SL/TP set automatically
                  </div>
                )}
                <div className={`grid grid-cols-2 gap-2 ${isAtrEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Stop Loss (pts)</span>
                    <input type="number" min="0" step="0.1" value={slPoints}
                      onChange={(e) => onSlPointsChange(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.red + '44', color: TV.red }} />
                  </div>
                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Take Profit (pts)</span>
                    <input type="number" min="0" step="0.1" value={tpPoints}
                      onChange={(e) => onTpPointsChange(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.green + '44', color: TV.green }} />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] block mb-1" style={{ color: TV.textMuted }}>Pip Value ($/pip)</span>
                  <input type="number" min="0.01" step="0.01" value={pipValue}
                    onChange={(e) => onPipValueChange(parseFloat(e.target.value) || 0.01)}
                    className="w-full text-xs px-2 py-1.5 rounded border outline-none" style={{ background: TV.bg, borderColor: TV.blue + '44', color: TV.blue }} />
                </div>
              </div>
            </Section>

            {/* Price levels */}
            {priceLines.length > 0 && (
              <Section title={`Active Levels (${priceLines.length})`}>
                <div className="flex flex-wrap gap-1.5">
                  {priceLines.map((price, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded" style={{ background: '#f472b618', color: '#f472b6', border: '1px solid #f472b633' }}>
                      {price.toFixed(pricePrecision)}
                      <button onClick={() => onRemoveLine(idx)} className="hover:text-white ml-0.5">x</button>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] mt-1" style={{ color: TV.textMuted }}>Press Z to remove oldest</div>
              </Section>
            )}
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR: Dashboard + Order Entry ========== */}
        <div className="shrink-0 border-l flex flex-col" style={{ width: '220px', borderColor: TV.border, background: '#0a0a1a' }}>
          {props.macdDashboard && <MacdDashboardPanel data={props.macdDashboard} />}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Order Entry */}
          <div className="flex flex-col gap-1.5 p-2" style={{ background: TV.panel, borderTop: `1px solid ${TV.border}` }}>
            {/* Price lines */}
            {priceLines.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-0.5">
                {priceLines.map((price, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: '#f472b622', color: '#f472b6', border: '1px solid #f472b644' }}>
                    {price.toFixed(pricePrecision)}
                    <button onClick={() => onRemoveLine(idx)} className="hover:text-white">x</button>
                  </div>
                ))}
              </div>
            )}

            {/* Live price */}
            <div className="text-center font-mono text-sm font-bold py-1 rounded" style={{ background: TV.bg, color: TV.text }}>
              {currentPrice.toFixed(pricePrecision)}
            </div>

            {/* BUY / SELL */}
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const atrEff = isAtrEnabled && currentAtr > 0 ? currentAtr : 0;
                  const effSl = atrEff > 0 ? atrEff * 1.5 : slPoints;
                  const effTp = atrEff > 0 ? atrEff * 3 : tpPoints;
                  onTrade(TradeType.LONG);
                  addToast('trade-open', `\u2713 LONG @ ${currentPrice.toFixed(pricePrecision)}${effSl > 0 ? ` | SL: ${(currentPrice - effSl).toFixed(pricePrecision)}` : ''}${effTp > 0 ? ` | TP: ${(currentPrice + effTp).toFixed(pricePrecision)}` : ''}`);
                }}
                className="flex-1 py-2 rounded font-bold text-xs text-white transition-all active:scale-95 hover:brightness-110"
                style={{ background: TV.green }}
              >
                BUY <span className="opacity-60 text-[9px] font-normal">(A)</span>
              </button>
              <button
                onClick={() => {
                  const atrEff = isAtrEnabled && currentAtr > 0 ? currentAtr : 0;
                  const effSl = atrEff > 0 ? atrEff * 1.5 : slPoints;
                  const effTp = atrEff > 0 ? atrEff * 3 : tpPoints;
                  onTrade(TradeType.SHORT);
                  addToast('trade-open', `\u2713 SHORT @ ${currentPrice.toFixed(pricePrecision)}${effSl > 0 ? ` | SL: ${(currentPrice + effSl).toFixed(pricePrecision)}` : ''}${effTp > 0 ? ` | TP: ${(currentPrice - effTp).toFixed(pricePrecision)}` : ''}`);
                }}
                className="flex-1 py-2 rounded font-bold text-xs text-white transition-all active:scale-95 hover:brightness-110"
                style={{ background: TV.red }}
              >
                SELL <span className="opacity-60 text-[9px] font-normal">(S)</span>
              </button>
            </div>

            {/* SL/TP hint */}
            <div className="text-center text-[9px] font-mono">
              <span style={{ color: '#f23645aa' }}>SL: {slPoints > 0 ? slPoints : '—'}</span>
              {' / '}
              <span style={{ color: '#089981aa' }}>TP: {tpPoints > 0 ? tpPoints : '—'}</span>
            </div>

            {/* Limit orders */}
            <div className="flex gap-1.5">
              <button
                disabled={priceLines.length === 0}
                className="flex-1 py-1 rounded text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: TV.green + '22', color: TV.green, border: `1px solid ${TV.green}44` }}
                title="Draw a price line on chart first (D)"
              >
                BUY LIM <span className="opacity-60 text-[8px]">(Q)</span>
              </button>
              <button
                disabled={priceLines.length === 0}
                className="flex-1 py-1 rounded text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: TV.red + '22', color: TV.red, border: `1px solid ${TV.red}44` }}
                title="Draw a price line on chart first (D)"
              >
                SELL LIM <span className="opacity-60 text-[8px]">(W)</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <ToastNotification messages={toasts} onDismiss={dismissToast} />

      {/* ========== BOTTOM PANEL ========== */}
      <div className="shrink-0 border-t" style={{ borderColor: TV.border, background: TV.panel }}>
        {/* Tabs header */}
        <div className="flex items-center justify-between h-8 px-3 border-b" style={{ borderColor: TV.border }}>
          <div className="flex items-center gap-0.5">
            {([
              ['positions', `Positions (${openTrades.length})`],
              ['orders', `Orders (${pendingTrades.length})`],
              ['history', `History (${closedTrades.length})`],
              ['journal', 'Journal'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (isBottomCollapsed) setIsBottomCollapsed(false); }}
                className="px-3 py-1 text-[11px] font-medium rounded-t transition-colors"
                style={{
                  color: activeTab === tab ? TV.text : TV.textMuted,
                  background: activeTab === tab ? TV.bg : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDownloadCSV} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: TV.textMuted }} title="Download CSV">
              <DownloadIcon />
            </button>
            <button onClick={() => setIsBottomCollapsed(!isBottomCollapsed)} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: TV.textMuted }}>
              {isBottomCollapsed ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>
        </div>

        {/* Journal tab */}
        {!isBottomCollapsed && activeTab === 'journal' && (
          <div className="p-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Win Rate', value: `${(sessionStats.winRate * 100).toFixed(1)}%`, color: sessionStats.winRate >= 0.5 ? '#089981' : '#f23645' },
              { label: 'Avg R:R', value: sessionStats.avgRR.toFixed(2), color: '#888' },
              { label: 'Profit Factor', value: sessionStats.profitFactor.toFixed(2), color: sessionStats.profitFactor >= 1 ? '#089981' : '#f23645' },
              { label: 'Largest Win', value: `$${sessionStats.largestWin.toFixed(2)}`, color: '#089981' },
              { label: 'Largest Loss', value: `$${Math.abs(sessionStats.largestLoss).toFixed(2)}`, color: '#f23645' },
              { label: 'Total Pips', value: sessionStats.totalPips.toFixed(1), color: sessionStats.totalPips >= 0 ? '#089981' : '#f23645' },
              { label: 'Max Consec W', value: String(sessionStats.maxConsecWins), color: '#089981' },
              { label: 'Max Consec L', value: String(sessionStats.maxConsecLosses), color: '#f23645' },
              { label: 'Avg Duration', value: `${sessionStats.avgDurationMinutes.toFixed(1)}m`, color: '#888' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded p-2 text-center" style={{ background: TV.panel }}>
                <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: '#555' }}>{label}</div>
                <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {!isBottomCollapsed && activeTab !== 'journal' && (
          <div className="overflow-auto" style={{ maxHeight: '200px' }}>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[10px] uppercase font-mono" style={{ color: TV.textMuted }}>
                  <th className="px-3 py-2 font-normal">Side</th>
                  <th className="px-3 py-2 font-normal">Entry</th>
                  <th className="px-3 py-2 font-normal">SL</th>
                  <th className="px-3 py-2 font-normal">TP</th>
                  <th className="px-3 py-2 font-normal text-right">PnL</th>
                  {activeTab === 'history' && <th className="px-3 py-2 font-normal">Exit</th>}
                  <th className="px-3 py-2 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {filteredTrades.map(trade => {
                  const rawDiff = trade.type === TradeType.LONG ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
                  const livePnl = trade.status === 'CLOSED' ? trade.pnl : trade.status === 'PENDING' ? 0 : (rawDiff / pipSize) * pipValue;
                  return (
                    <tr key={trade.id} className={`border-t hover:bg-white/10 transition-colors duration-150 group${trade.status === 'OPEN' ? ` border-l-2 ${trade.type === TradeType.LONG ? 'border-l-green-500' : 'border-l-red-500'}` : ''}`} style={{ borderColor: TV.border + '66' }}>
                      <td className="px-3 py-2 font-bold" style={{ color: trade.type === TradeType.LONG ? TV.green : TV.red }}>
                        {trade.type === TradeType.LONG ? 'LONG' : 'SHORT'}
                      </td>
                      <td className="px-3 py-2" style={{ color: TV.text }}>{trade.entryPrice.toFixed(pricePrecision)}</td>
                      <td className="px-3 py-2" style={{ color: trade.stopLoss ? TV.red : TV.textMuted }}>
                        {trade.stopLoss ? trade.stopLoss.toFixed(pricePrecision) : '-'}
                      </td>
                      <td className="px-3 py-2" style={{ color: trade.takeProfit ? TV.green : TV.textMuted }}>
                        {trade.takeProfit ? trade.takeProfit.toFixed(pricePrecision) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: trade.status === 'PENDING' ? '#f59e0b' : livePnl! >= 0 ? TV.green : TV.red }}>
                        {trade.status === 'PENDING' ? 'PENDING' : `$${livePnl!.toFixed(2)}`}
                      </td>
                      {activeTab === 'history' && (
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-bold" style={{ color: trade.exitReason === 'TP' ? TV.green : trade.exitReason === 'SL' ? TV.red : TV.textSec }}>
                            {trade.exitReason || '-'}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onSelectTrade(trade)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: TV.textMuted }} title="Details">
                            <ClipboardIcon />
                          </button>
                          {trade.status !== 'CLOSED' && (
                            <button onClick={() => onCloseTrade(trade.id)} className="px-2 py-0.5 rounded text-[10px] font-bold hover:bg-white/10 transition-colors" style={{ color: TV.red }}>
                              CLOSE
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTrades.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'history' ? 7 : 6} className="py-6 text-center text-[11px]" style={{ color: TV.textMuted }}>
                      {activeTab === 'positions' ? 'No open positions' : activeTab === 'orders' ? 'No pending orders' : activeTab === 'history' ? 'No trade history' : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-4 border-b" style={{ borderColor: TV.border }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: TV.textMuted }}>{title}</div>
      {children}
    </div>
  );
}

function Param({ label, children, disabled, blind }: { label: string; children: React.ReactNode; disabled?: boolean; blind?: boolean }) {
  return (
    <div className={`space-y-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center">
        <span className="text-[11px]" style={{ color: TV.textSec }}>{label}</span>
        {blind && <span className="text-[11px]" style={{ color: TV.textMuted }}>****</span>}
      </div>
      {children}
    </div>
  );
}
