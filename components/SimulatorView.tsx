import React from 'react';
import { FinancialChart } from './FinancialChart';
import { ErrorBoundary } from './ErrorBoundary';
import { TradeDetailsModal } from './TradeDetailsModal';
import { CandleData, MacdData, Trade, TradeType, MarketConfig, SimulationType, SessionStats, MacdDashboardData, RsiDashboardData } from '../types';

// Icons
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
const ClipboardListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14h.01"></path><path d="M9 10h.01"></path><path d="M9 18h.01"></path><path d="M13 14h4"></path><path d="M13 10h4"></path><path d="M13 18h4"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;

const SIM_LABELS: Record<SimulationType, string> = {
  [SimulationType.GBM]: 'GBM',
  [SimulationType.MOMENTUM]: 'MOMENTUM',
  [SimulationType.OU]: 'MEAN REV',
  [SimulationType.GARCH]: 'GARCH',
};

const SIM_MODEL_LABELS: Record<SimulationType, string> = {
  [SimulationType.GBM]: 'GBM Stochastic',
  [SimulationType.MOMENTUM]: 'Autocorrelation',
  [SimulationType.OU]: 'Ornstein-Uhlenbeck',
  [SimulationType.GARCH]: 'GARCH(1,1)',
};

export interface SimulatorViewProps {
  // Chart data
  candles: CandleData[];
  macdData: MacdData[];
  emaData: { time: number; value: number }[];
  hma2Data: { time: number; value: number }[];
  hmaData: { time: number; value: number }[];
  hmaBandData: { time: number; value: number }[];
  priceLines: number[];
  trades: Trade[];
  pnl: number;
  selectedTrade: Trade | null;

  // Config
  config: MarketConfig;
  macdSettings: { fast: number; slow: number; signal: number };
  emaPeriod: number;
  hma2Period: number;
  hmaPeriod: number;
  emaColor: string;
  hma2Color: string;
  hmaColor: string;
  isEma1Visible: boolean;
  isHma2Visible: boolean;
  isHmaVisible: boolean;
  isMacdVisible: boolean;
  slPoints: number;
  tpPoints: number;
  pipSize: number;
  pipValue: number;

  // Modes
  isPlaying: boolean;
  isAutoMode: boolean;
  isBlindMode: boolean;
  isDrawingMode: boolean;
  currentSessionLabel: string;

  // Sim type
  selectedSim: SimulationType;

  // Per-engine params
  momentumParams: { volatility: number; trendStrength: number; drift: number };
  ouParams: { meanLevel: number; reversionSpeed: number; volatility: number };
  garchParams: { omega: number; alpha: number; beta: number; drift: number };
  currentGarchSigma: number;

  // Display
  currentPrice: number;
  currentTimeDisplay: string;
  pricePrecision: number;

  // Handlers
  onReturnToMenu: () => void;
  onReset: () => void;
  onTogglePlay: () => void;
  onToggleAutoMode: () => void;
  onToggleBlindMode: () => void;
  onToggleDrawingMode: () => void;
  onConfigChange: (config: MarketConfig) => void;
  onMacdSettingsChange: (settings: { fast: number; slow: number; signal: number }) => void;
  onEmaPeriodChange: (period: number) => void;
  onHma2PeriodChange: (period: number) => void;
  onHmaPeriodChange: (period: number) => void;
  onEmaColorChange: (color: string) => void;
  onHma2ColorChange: (color: string) => void;
  onHmaColorChange: (color: string) => void;
  onEma1VisibleChange: (v: boolean) => void;
  onHma2VisibleChange: (v: boolean) => void;
  onHmaVisibleChange: (v: boolean) => void;
  onMacdVisibleChange: (v: boolean) => void;
  onSlPointsChange: (v: number) => void;
  onTpPointsChange: (v: number) => void;
  onPipValueChange: (v: number) => void;
  onTrade: (type: TradeType) => void;
  onCloseTrade: (id: string) => void;
  onSelectTrade: (trade: Trade | null) => void;
  onChartClick: (price: number) => void;
  onRemoveLine: (index: number) => void;
  onDownloadCSV: () => void;
  onMomentumParamsChange: (p: { volatility: number; trendStrength: number; drift: number }) => void;
  onOuParamsChange: (p: { meanLevel: number; reversionSpeed: number; volatility: number }) => void;
  onGarchParamsChange: (p: { omega: number; alpha: number; beta: number; drift: number }) => void;
  currentAtr: number;
  atrPeriod: number;
  isAtrEnabled: boolean;
  onAtrPeriodChange: (p: number) => void;
  onAtrEnabledChange: (v: boolean) => void;
  sessionStats: SessionStats;
  macdDashboard: MacdDashboardData;
  rsiDashboard: RsiDashboardData;
}

export function SimulatorView(props: SimulatorViewProps) {
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
  } = props;

  const garchAB = garchParams.alpha + garchParams.beta;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-indigo-500/30">
      <TradeDetailsModal trade={selectedTrade} pricePrecision={pricePrecision} onClose={() => onSelectTrade(null)} />

      {/* Header */}
      <header className="h-14 border-b border-slate-700 bg-slate-800/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            <h1 className="font-bold text-lg tracking-tight text-white">Quant<span className="text-indigo-400">Flow</span> Sim</h1>
          </div>

          {/* Session badge */}
          <div className={`px-3 py-1 rounded text-xs font-bold border ${isAutoMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
            {isAutoMode ? currentSessionLabel : 'MANUAL MODE'}
          </div>

          {/* Sim type badge */}
          <span className="px-2 py-1 rounded text-xs font-bold bg-slate-700/50 border border-slate-600 text-slate-300">
            {SIM_LABELS[selectedSim]}
          </span>

          {/* Change Sim button */}
          <button
            onClick={onReturnToMenu}
            className="px-3 py-1 rounded text-xs border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            Change Sim
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Simulated Time (Madrid)</div>
            <div className="font-mono text-lg leading-none text-emerald-400">{currentTimeDisplay}</div>
          </div>
          <div className="font-mono text-sm px-4 py-2 rounded-lg border bg-slate-700/50 border-slate-600 text-slate-300">
            Open: {trades.filter(t => t.status === 'OPEN').length}
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
              <button onClick={onReset} className="text-slate-500 hover:text-white" title="Reset Simulation">
                <RefreshIcon />
              </button>
            </h2>

            <div className="space-y-4">
              {/* Play/Pause */}
              <button
                onClick={onTogglePlay}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${isPlaying ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'}`}
                title="Spacebar to Toggle"
              >
                {isPlaying ? <><PauseIcon /> PAUSE FEED</> : <><PlayIcon /> START FEED</>}
              </button>

              {/* Modes */}
              <div className="grid grid-cols-2 gap-2">
                {selectedSim === SimulationType.GBM && (
                  <button
                    onClick={onToggleAutoMode}
                    className={`px-2 py-2 rounded text-xs font-semibold border transition-all ${isAutoMode ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                  >
                    Real Trading Day
                  </button>
                )}
                {selectedSim !== SimulationType.GBM && (
                  <div className="px-2 py-2 rounded text-xs font-semibold border bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed text-center">
                    Auto Mode (GBM)
                  </div>
                )}
                <button
                  onClick={onToggleBlindMode}
                  className={`px-2 py-2 rounded text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${isBlindMode ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                >
                  {isBlindMode ? <EyeOffIcon /> : <EyeIcon />} Blind Mode
                </button>
              </div>

              {/* Tick Speed */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 flex justify-between items-center">
                  <span>Update Speed (ms)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={config.tickSpeedMs}
                      onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) || 100 })}
                      className="bg-transparent text-right text-slate-300 font-mono text-xs w-14 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0"
                    />
                    <span className="text-slate-500 font-mono text-xs">ms</span>
                  </div>
                </label>
                <input
                  type="range" min="20" max="5000" step="20"
                  value={config.tickSpeedMs}
                  onChange={(e) => onConfigChange({ ...config, tickSpeedMs: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                />
              </div>

              {/* --- Adaptive Engine Parameters --- */}
              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">{SIM_MODEL_LABELS[selectedSim]}</div>

                {/* GBM params */}
                {selectedSim === SimulationType.GBM && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between items-center">
                        <span>Volatility (σ)</span>
                        {isBlindMode ? (
                          <span className="text-slate-600 select-none">****</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" step="0.01" min="0"
                              disabled={isAutoMode}
                              value={parseFloat((config.volatility * 100).toFixed(3))}
                              onChange={(e) => onConfigChange({ ...config, volatility: (parseFloat(e.target.value) || 0) / 100 })}
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
                        onChange={(e) => onConfigChange({ ...config, volatility: parseFloat(e.target.value) })}
                        className={`w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer ${isAutoMode ? 'cursor-default' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between items-center">
                        <span>Drift (μ)</span>
                        {isBlindMode ? (
                          <span className="text-slate-600 select-none">****</span>
                        ) : (
                          <input
                            type="number" step="0.00001"
                            disabled={isAutoMode}
                            value={parseFloat(config.drift.toFixed(5))}
                            onChange={(e) => onConfigChange({ ...config, drift: parseFloat(e.target.value) || 0 })}
                            className={`bg-transparent text-right ${config.drift > 0 ? 'text-emerald-400' : 'text-red-400'} font-mono text-xs w-20 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0 ${isAutoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        )}
                      </label>
                      <input
                        type="range" min="-0.002" max="0.002" step="0.0001"
                        value={config.drift}
                        disabled={isAutoMode}
                        onChange={(e) => onConfigChange({ ...config, drift: parseFloat(e.target.value) })}
                        className={`w-full accent-indigo-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer ${isAutoMode ? 'cursor-default' : ''}`}
                      />
                    </div>
                  </>
                )}

                {/* MOMENTUM params */}
                {selectedSim === SimulationType.MOMENTUM && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Volatility (σ)</span>
                        <span className="text-emerald-400 font-mono">{(momentumParams.volatility * 100).toFixed(3)}%</span>
                      </label>
                      <input
                        type="range" min="0.0005" max="0.01" step="0.0001"
                        value={momentumParams.volatility}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, volatility: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Trend Strength</span>
                        <span className="text-emerald-400 font-mono">
                          {momentumParams.trendStrength.toFixed(2)}
                          {momentumParams.trendStrength < 0.3 ? ' (choppy)' : momentumParams.trendStrength > 0.7 ? ' (strong)' : ' (moderate)'}
                        </span>
                      </label>
                      <input
                        type="range" min="0" max="0.95" step="0.05"
                        value={momentumParams.trendStrength}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, trendStrength: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Drift (μ)</span>
                        <input
                          type="number" step="0.00001"
                          value={parseFloat(momentumParams.drift.toFixed(5))}
                          onChange={(e) => onMomentumParamsChange({ ...momentumParams, drift: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent text-right ${momentumParams.drift > 0 ? 'text-emerald-400' : 'text-red-400'} font-mono text-xs w-20 border-b border-transparent focus:border-indigo-500 outline-none p-0`}
                        />
                      </label>
                      <input
                        type="range" min="-0.002" max="0.002" step="0.0001"
                        value={momentumParams.drift}
                        onChange={(e) => onMomentumParamsChange({ ...momentumParams, drift: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                  </>
                )}

                {/* OU params */}
                {selectedSim === SimulationType.OU && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between items-center">
                        <span>Mean Level (μ)</span>
                        <input
                          type="number" step="1"
                          value={ouParams.meanLevel}
                          onChange={(e) => onOuParamsChange({ ...ouParams, meanLevel: parseFloat(e.target.value) || ouParams.meanLevel })}
                          className="bg-transparent text-right text-amber-400 font-mono text-xs w-20 border-b border-transparent focus:border-amber-500 outline-none p-0"
                        />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Reversion Speed (θ)</span>
                        <span className="text-amber-400 font-mono text-xs">
                          {ouParams.reversionSpeed.toFixed(4)} (t½≈{Math.round(Math.log(2) / ouParams.reversionSpeed)} bars)
                        </span>
                      </label>
                      <input
                        type="range" min="0.001" max="0.1" step="0.001"
                        value={ouParams.reversionSpeed}
                        onChange={(e) => onOuParamsChange({ ...ouParams, reversionSpeed: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Noise σ</span>
                        <span className="text-amber-400 font-mono">{ouParams.volatility.toFixed(2)}</span>
                      </label>
                      <input
                        type="range" min="0.1" max="10" step="0.1"
                        value={ouParams.volatility}
                        onChange={(e) => onOuParamsChange({ ...ouParams, volatility: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                  </>
                )}

                {/* GARCH params */}
                {selectedSim === SimulationType.GARCH && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Alpha (α)</span>
                        <span className="text-rose-400 font-mono">{garchParams.alpha.toFixed(2)}</span>
                      </label>
                      <input
                        type="range" min="0.01" max="0.5" step="0.01"
                        value={garchParams.alpha}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, alpha: parseFloat(e.target.value) })}
                        className="w-full accent-rose-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between">
                        <span>Beta (β)</span>
                        <span className="text-rose-400 font-mono">{garchParams.beta.toFixed(2)}</span>
                      </label>
                      <input
                        type="range" min="0.1" max="0.95" step="0.01"
                        value={garchParams.beta}
                        onChange={(e) => onGarchParamsChange({ ...garchParams, beta: parseFloat(e.target.value) })}
                        className="w-full accent-rose-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>
                    {garchAB > 0.98 && (
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                        ⚠ α+β={garchAB.toFixed(2)} — near non-stationarity
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between items-center">
                        <span>Omega (ω)</span>
                        <input
                          type="number" step="0.0000001"
                          value={garchParams.omega}
                          onChange={(e) => onGarchParamsChange({ ...garchParams, omega: parseFloat(e.target.value) || garchParams.omega })}
                          className="bg-transparent text-right text-rose-400 font-mono text-xs w-24 border-b border-transparent focus:border-rose-500 outline-none p-0"
                        />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 flex justify-between items-center">
                        <span>Drift (μ)</span>
                        <input
                          type="number" step="0.00001"
                          value={parseFloat(garchParams.drift.toFixed(5))}
                          onChange={(e) => onGarchParamsChange({ ...garchParams, drift: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent text-right ${garchParams.drift > 0 ? 'text-emerald-400' : 'text-red-400'} font-mono text-xs w-20 border-b border-transparent focus:border-indigo-500 outline-none p-0`}
                        />
                      </label>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Current σ</span>
                      <span className="text-rose-400 font-mono">{(currentGarchSigma * 100).toFixed(4)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Technical Tools */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-wider">Analysis Tools</h2>

            {/* EMA 1 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button onClick={() => onEma1VisibleChange(!isEma1Visible)} className="text-slate-500 hover:text-white transition-colors">
                    {isEma1Visible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <label className="text-xs text-slate-500">EMA 1 Period</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={emaColor} onChange={(e) => onEmaColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" title="EMA Color" />
                  <input type="number" min="1" value={emaPeriod} onChange={(e) => onEmaPeriodChange(parseInt(e.target.value) || 1)} className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0" style={{ color: emaColor }} />
                </div>
              </div>
              <input type="range" min="5" max="200" step="5" value={emaPeriod} onChange={(e) => onEmaPeriodChange(parseInt(e.target.value))} className="w-full accent-yellow-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer" style={{ accentColor: emaColor }} />
            </div>

            {/* HMA 2 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button onClick={() => onHma2VisibleChange(!isHma2Visible)} className="text-slate-500 hover:text-white transition-colors">
                    {isHma2Visible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <label className="text-xs text-slate-500">HMA 2 Period</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={hma2Color} onChange={(e) => onHma2ColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" title="HMA 2 Color" />
                  <input type="number" min="1" value={hma2Period} onChange={(e) => onHma2PeriodChange(parseInt(e.target.value) || 1)} className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0" style={{ color: hma2Color }} />
                </div>
              </div>
              <input type="range" min="5" max="200" step="5" value={hma2Period} onChange={(e) => onHma2PeriodChange(parseInt(e.target.value))} className="w-full accent-cyan-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer" style={{ accentColor: hma2Color }} />
            </div>

            {/* HMA */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button onClick={() => onHmaVisibleChange(!isHmaVisible)} className="text-slate-500 hover:text-white transition-colors">
                    {isHmaVisible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <label className="text-xs text-slate-500">HMA Period</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={hmaColor} onChange={(e) => onHmaColorChange(e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" title="HMA Color" />
                  <input type="number" min="1" value={hmaPeriod} onChange={(e) => onHmaPeriodChange(parseInt(e.target.value) || 1)} className="bg-transparent text-right font-mono text-xs w-10 border-b border-transparent focus:border-indigo-500 focus:bg-slate-900/50 outline-none transition-all p-0" style={{ color: hmaColor }} />
                </div>
              </div>
              <input type="range" min="5" max="300" step="5" value={hmaPeriod} onChange={(e) => onHmaPeriodChange(parseInt(e.target.value))} className="w-full accent-violet-500 bg-slate-700 h-1 rounded appearance-none cursor-pointer" style={{ accentColor: hmaColor }} />
            </div>

            {/* MACD Settings */}
            <div className="space-y-2 mb-4 border-t border-slate-700 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => onMacdVisibleChange(!isMacdVisible)} className="text-slate-500 hover:text-white transition-colors">
                  {isMacdVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <label className="text-xs text-slate-500 block">MACD ({macdSettings.fast}, {macdSettings.slow}, {macdSettings.signal})</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">Fast</span>
                  <input type="number" min="1" max="100" value={macdSettings.fast} onChange={(e) => onMacdSettingsChange({ ...macdSettings, fast: Math.max(1, parseInt(e.target.value) || 12) })} className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Slow</span>
                  <input type="number" min="1" max="200" value={macdSettings.slow} onChange={(e) => onMacdSettingsChange({ ...macdSettings, slow: Math.max(1, parseInt(e.target.value) || 26) })} className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Signal</span>
                  <input type="number" min="1" max="50" value={macdSettings.signal} onChange={(e) => onMacdSettingsChange({ ...macdSettings, signal: Math.max(1, parseInt(e.target.value) || 9) })} className="w-full bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none text-slate-200" />
                </div>
              </div>
            </div>

            {/* Drawing Tools */}
            <div className="flex gap-2">
              <button
                onClick={onToggleDrawingMode}
                className={`flex-1 flex items-center justify-center gap-1 py-2 border rounded-lg text-xs transition-colors ${isDrawingMode ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                title="Draw Support/Resistance Lines"
              >
                <PencilIcon /> {isDrawingMode ? 'ACTIVE' : 'DRAW'}
              </button>
            </div>

            {/* Active Levels */}
            {priceLines.length > 0 && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  {priceLines.map((price, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] bg-slate-700 px-2 py-1 rounded border border-slate-600">
                      <span className="text-pink-400 font-mono">{price.toFixed(pricePrecision)}</span>
                      <button onClick={() => onRemoveLine(idx)} className="text-slate-400 hover:text-white">×</button>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-slate-600 italic text-right">(Press 'Z' to remove oldest)</div>
              </div>
            )}
          </div>

          {/* Trading Panel */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex-1 flex flex-col min-h-[350px]">
            <h2 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-wider">Execution</h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Stop Loss (pts)</label>
                <div className="relative">
                  <input type="number" min="0" step="0.1" value={slPoints} onChange={(e) => onSlPointsChange(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900/50 text-sm px-2 py-1.5 rounded border border-red-900/50 focus:border-red-500 outline-none text-red-300" />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-600">pts</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Take Profit (pts)</label>
                <div className="relative">
                  <input type="number" min="0" step="0.1" value={tpPoints} onChange={(e) => onTpPointsChange(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900/50 text-sm px-2 py-1.5 rounded border border-emerald-900/50 focus:border-emerald-500 outline-none text-emerald-300" />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-600">pts</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-slate-500 block mb-1">Pip Value ($)</label>
              <div className="relative">
                <input type="number" min="0.01" step="0.01" value={pipValue} onChange={(e) => onPipValueChange(parseFloat(e.target.value) || 0.01)} className="w-full bg-slate-900/50 text-sm px-2 py-1.5 rounded border border-sky-900/50 focus:border-sky-500 outline-none text-sky-300" />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-600">$/pip</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <button onClick={() => onTrade(TradeType.LONG)} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-transform active:scale-95 text-sm flex flex-col items-center justify-center">
                <span>BUY <span className="opacity-70 font-normal text-[10px]">(A)</span></span>
                {(tpPoints > 0 || slPoints > 0) && <span className="text-[9px] font-normal opacity-70 mt-0.5">{tpPoints > 0 && `TP:+${tpPoints}`} {slPoints > 0 && `SL:-${slPoints}`}</span>}
              </button>
              <button onClick={() => onTrade(TradeType.SHORT)} className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-900/20 transition-transform active:scale-95 text-sm flex flex-col items-center justify-center">
                <span>SELL <span className="opacity-70 font-normal text-[10px]">(S)</span></span>
                {(tpPoints > 0 || slPoints > 0) && <span className="text-[9px] font-normal opacity-70 mt-0.5">{tpPoints > 0 && `TP:-${tpPoints}`} {slPoints > 0 && `SL:+${slPoints}`}</span>}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button disabled={priceLines.length === 0} className="bg-emerald-900/50 hover:bg-emerald-800/50 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-300 border border-emerald-700/50 py-1.5 rounded-lg font-semibold transition-transform active:scale-95 text-[11px] flex flex-col items-center justify-center" title="Buy limit at last price line">
                <span>BUY LIMIT <span className="opacity-70 font-normal text-[9px]">(Q)</span></span>
                {priceLines.length > 0 && <span className="text-[9px] font-normal opacity-70">@ {priceLines[priceLines.length - 1].toFixed(pricePrecision)}</span>}
              </button>
              <button disabled={priceLines.length === 0} className="bg-red-900/50 hover:bg-red-800/50 disabled:opacity-30 disabled:cursor-not-allowed text-red-300 border border-red-700/50 py-1.5 rounded-lg font-semibold transition-transform active:scale-95 text-[11px] flex flex-col items-center justify-center" title="Sell limit at last price line">
                <span>SELL LIMIT <span className="opacity-70 font-normal text-[9px]">(W)</span></span>
                {priceLines.length > 0 && <span className="text-[9px] font-normal opacity-70">@ {priceLines[priceLines.length - 1].toFixed(pricePrecision)}</span>}
              </button>
            </div>

            <div className="flex-1 overflow-auto border-t border-slate-700 pt-2">
              <h3 className="text-xs text-slate-500 mb-2 font-semibold flex justify-between items-center">
                <span>Order Book / History</span>
                <button onClick={onDownloadCSV} className="text-slate-500 hover:text-white transition-colors p-1" title="Download Trade History CSV">
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
                    const isPending = trade.status === 'PENDING';
                    const rawDiff = trade.type === TradeType.LONG ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
                    const livePnl = isClosed
                      ? trade.pnl
                      : isPending ? 0 : (rawDiff / pipSize) * pipValue;
                    return (
                      <tr key={trade.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 group ${isPending ? 'opacity-60' : ''}`}>
                        <td className={`py-2 ${trade.type === TradeType.LONG ? 'text-emerald-400' : 'text-red-400'}`}>
                          <div className="flex flex-col">
                            <span>{isPending ? `${trade.type.substring(0, 1)}⏳` : trade.type.substring(0, 1)}</span>
                            {trade.stopLoss && <span className="text-[8px] text-slate-600">SL:{trade.stopLoss.toFixed(pricePrecision)}</span>}
                          </div>
                        </td>
                        <td className="py-2 text-slate-300 align-top">
                          {trade.entryPrice.toFixed(pricePrecision)}
                          {isPending && <div className="text-[8px] text-amber-500">LIMIT</div>}
                          {trade.takeProfit && <div className="text-[8px] text-slate-600">TP:{trade.takeProfit.toFixed(pricePrecision)}</div>}
                        </td>
                        <td className={`py-2 text-right font-bold align-top ${isPending ? 'text-amber-400' : livePnl! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPending ? '—' : `$${livePnl!.toFixed(2)}`}
                        </td>
                        <td className="py-2 text-right align-top">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => onSelectTrade(trade)} className="text-slate-500 hover:text-white transition-colors p-1" title="View Technical Details">
                              <ClipboardListIcon />
                            </button>
                            {!isClosed && (
                              <button onClick={() => onCloseTrade(trade.id)} className="text-[9px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded opacity-80 hover:opacity-100 transition-opacity ml-1">
                                {isPending ? '✕' : 'X'}
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

          {/* Overlay Stats */}
          <div className="absolute bottom-6 left-6 flex gap-2 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl">
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Last Update</span>
              <span className="text-slate-200">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xl">
              <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Model</span>
              <span className="text-indigo-400">{SIM_MODEL_LABELS[selectedSim]}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
