import React, { useState } from 'react';
import { SimulationType, MarketPreset } from '../types';

interface SimulationMenuProps {
  onSelect: (simType: SimulationType, preset?: MarketPreset, v2?: boolean) => void;
}

const EURUSD_POINTS = [50,50.3,49.8,50.5,50.2,49.6,49.9,50.4,50.1,49.7,50.3,50.6,50.2,49.8,50.1,50.5,50.0,49.5,49.8,50.2];
const GBM_POINTS = [50,48,52,47,53,49,55,50,46,51,54,48,52,49,56,51,47,53,50,52];
const MOMENTUM_POINTS = [50,51,53,56,54,57,60,62,65,63,66,69,72,70,73,76,74,77,80,78];
const OU_POINTS = [50,54,58,62,60,56,52,50,48,52,56,60,57,53,50,52,56,59,55,51];
const GARCH_POINTS = [50,51,50,52,49,50,51,48,52,50,42,35,45,38,55,62,50,58,44,52];

function Sparkline({ points, color, width = 160, height = 48 }: { points: number[]; color: string; width?: number; height?: number }) {
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = maxY - minY || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - minY) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

interface LegacyCard {
  type: SimulationType;
  preset?: MarketPreset;
  v2?: boolean;
  name: string;
  description: string;
  badge: string;
  accentHex: string;
  glowRgb: string;
  points: number[];
}

const legacyCards: LegacyCard[] = [
  {
    type: SimulationType.GBM,
    name: 'Classic GBM',
    description: 'Geometric Brownian Motion — random log-normal price movements with no memory.',
    badge: 'RANDOM WALK',
    accentHex: '#6366f1',
    glowRgb: '99,102,241',
    points: GBM_POINTS,
  },
  {
    type: SimulationType.MOMENTUM,
    name: 'Momentum / Trending',
    description: 'Autocorrelated returns create persistent trends and directional moves.',
    badge: 'TRENDING',
    accentHex: '#10b981',
    glowRgb: '16,185,129',
    points: MOMENTUM_POINTS,
  },
  {
    type: SimulationType.OU,
    name: 'Mean Reversion',
    description: 'Ornstein-Uhlenbeck — price pulled toward a long-term mean level.',
    badge: 'MEAN REVERTING',
    accentHex: '#f59e0b',
    glowRgb: '245,158,11',
    points: OU_POINTS,
  },
  {
    type: SimulationType.GARCH,
    name: 'GARCH Volatility',
    description: 'GARCH(1,1) — calm periods punctuated by explosive volatility bursts.',
    badge: 'VOLATILE',
    accentHex: '#f43f5e',
    glowRgb: '244,63,94',
    points: GARCH_POINTS,
  },
  {
    type: SimulationType.GBM,
    preset: MarketPreset.EURUSD,
    name: 'EUR/USD Forex (V1)',
    description: 'GBM calibrated for EUR/USD with the original simulator interface.',
    badge: 'FOREX',
    accentHex: '#0ea5e9',
    glowRgb: '14,165,233',
    points: EURUSD_POINTS,
  },
];

export function SimulationMenu({ onSelect }: SimulationMenuProps) {
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [hoveredLegacy, setHoveredLegacy] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">
          Quant<span className="text-indigo-400">Flow</span><span className="text-slate-300 font-light">Sim</span>
        </h1>
        <p className="text-slate-500 text-sm tracking-wide">Select a market simulation model to begin your session</p>
      </div>

      {/* Hero Card: EUR/USD v2 */}
      <button
        onClick={() => onSelect(SimulationType.GBM, MarketPreset.EURUSD, true)}
        onMouseEnter={() => setIsHeroHovered(true)}
        onMouseLeave={() => setIsHeroHovered(false)}
        className="relative w-full max-w-3xl text-left bg-slate-900 border rounded-2xl p-8 overflow-hidden transition-all duration-300 cursor-pointer mb-8"
        style={{
          transform: isHeroHovered ? 'scale(1.01) translateY(-4px)' : 'scale(1) translateY(0)',
          borderColor: isHeroHovered ? '#8b5cf699' : '#334155',
          boxShadow: isHeroHovered ? '0 0 40px -5px rgba(139,92,246,0.35)' : undefined,
        }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: 'radial-gradient(ellipse at top left, rgba(139,92,246,0.1) 0%, transparent 60%)',
            opacity: isHeroHovered ? 1 : 0,
          }}
        />

        <div className="flex items-start gap-6 relative">
          {/* Left: text */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-slate-800/80">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-xl">EUR/USD v2</h2>
                <span
                  className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full border"
                  style={{ color: '#8b5cf6', borderColor: '#8b5cf655', backgroundColor: '#8b5cf633' }}
                >
                  PRO
                </span>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Professional TradingView-inspired interface with MACD Dashboard, ATR-based risk management, real-time drift scoring, and full keyboard control.
            </p>
            <div
              className="text-sm font-semibold transition-opacity duration-300"
              style={{ color: '#8b5cf6', opacity: isHeroHovered ? 1 : 0.6 }}
            >
              Start trading →
            </div>
          </div>

          {/* Right: sparkline */}
          <div className="hidden md:block pt-2 transition-opacity duration-300" style={{ opacity: isHeroHovered ? 1 : 0.5 }}>
            <Sparkline points={EURUSD_POINTS} color="#8b5cf6" width={200} height={60} />
          </div>
        </div>
      </button>

      {/* Legacy Section Toggle */}
      <button
        onClick={() => setShowLegacy(v => !v)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-400 text-xs font-mono uppercase tracking-widest mb-4 transition-colors"
      >
        <span>{showLegacy ? '\u25bc' : '\u25b6'}</span>
        <span>Legacy Simulations</span>
      </button>

      {/* Legacy Cards Grid */}
      {showLegacy && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
          {legacyCards.map((card, idx) => {
            const isHovered = hoveredLegacy === idx;
            return (
              <button
                key={card.name}
                onClick={() => onSelect(card.type, card.preset, card.v2)}
                onMouseEnter={() => setHoveredLegacy(idx)}
                onMouseLeave={() => setHoveredLegacy(null)}
                className="relative text-left bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 overflow-hidden transition-all duration-300 cursor-pointer"
                style={{
                  transform: isHovered ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)',
                  borderColor: isHovered ? card.accentHex + '66' : undefined,
                  boxShadow: isHovered ? `0 0 20px -5px rgba(${card.glowRgb},0.25)` : undefined,
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(ellipse at top left, rgba(${card.glowRgb},0.06) 0%, transparent 60%)`,
                    opacity: isHovered ? 1 : 0,
                  }}
                />
                <div className="flex items-center justify-between mb-2 relative">
                  <h3 className="text-white font-semibold text-sm">{card.name}</h3>
                  <span
                    className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-full border"
                    style={{ color: card.accentHex, borderColor: card.accentHex + '44', backgroundColor: card.accentHex + '22' }}
                  >
                    {card.badge}
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed mb-3 relative">{card.description}</p>
                <div className="relative transition-opacity duration-300" style={{ opacity: isHovered ? 1 : 0.4 }}>
                  <Sparkline points={card.points} color={card.accentHex} width={140} height={36} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <p className="mt-10 text-slate-700 text-xs text-center">
        All models use deterministic tick simulation &bull; No real financial data
      </p>
    </div>
  );
}
