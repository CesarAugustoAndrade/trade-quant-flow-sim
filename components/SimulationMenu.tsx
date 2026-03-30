import React, { useState } from 'react';
import { SimulationType, MarketPreset } from '../types';

interface SimulationMenuProps {
  onSelect: (simType: SimulationType, preset?: MarketPreset, v2?: boolean) => void;
}

// Pre-computed sparkline point sets for each sim type
const GBM_POINTS = [50,48,52,47,53,49,55,50,46,51,54,48,52,49,56,51,47,53,50,52];
const MOMENTUM_POINTS = [50,51,53,56,54,57,60,62,65,63,66,69,72,70,73,76,74,77,80,78];
const OU_POINTS = [50,54,58,62,60,56,52,50,48,52,56,60,57,53,50,52,56,59,55,51];
const GARCH_POINTS = [50,51,50,52,49,50,51,48,52,50,42,35,45,38,55,62,50,58,44,52];
const EURUSD_POINTS = [50,50.3,49.8,50.5,50.2,49.6,49.9,50.4,50.1,49.7,50.3,50.6,50.2,49.8,50.1,50.5,50.0,49.5,49.8,50.2];

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 160, h = 48;
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = maxY - minY || 1;
  const step = w / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - minY) / range) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

interface SimCard {
  type: SimulationType;
  preset?: MarketPreset;
  v2?: boolean;
  name: string;
  description: string;
  badge: string;
  accent: string;
  accentHex: string;
  glowRgb: string;
  icon: React.ReactNode;
  points: number[];
}

const cards: SimCard[] = [
  {
    type: SimulationType.GBM,
    name: 'Classic GBM',
    description: 'Geometric Brownian Motion — the standard Black-Scholes model. Purely random log-normal price movements with no memory.',
    badge: 'RANDOM WALK',
    accent: 'indigo',
    accentHex: '#6366f1',
    glowRgb: '99,102,241',
    points: GBM_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    type: SimulationType.MOMENTUM,
    name: 'Momentum / Trending',
    description: 'Autocorrelated returns create persistent trends. Price tends to continue in its current direction — momentum drives the market.',
    badge: 'TRENDING',
    accent: 'emerald',
    accentHex: '#10b981',
    glowRgb: '16,185,129',
    points: MOMENTUM_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="17" x2="19" y2="7" />
        <polyline points="13 7 19 7 19 13" />
      </svg>
    ),
  },
  {
    type: SimulationType.OU,
    name: 'Mean Reversion',
    description: 'Ornstein-Uhlenbeck process. Price is pulled toward a long-term mean — deviations are temporary and self-correcting.',
    badge: 'MEAN REVERTING',
    accent: 'amber',
    accentHex: '#f59e0b',
    glowRgb: '245,158,11',
    points: OU_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    type: SimulationType.GARCH,
    name: 'GARCH Volatility',
    description: 'GARCH(1,1) volatility clustering. Calm periods punctuated by explosive bursts — volatility begets volatility.',
    badge: 'VOLATILE',
    accent: 'rose',
    accentHex: '#f43f5e',
    glowRgb: '244,63,94',
    points: GARCH_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    type: SimulationType.GBM,
    preset: MarketPreset.EURUSD,
    name: 'EUR/USD Forex',
    description: 'GBM simulation calibrated for EUR/USD — realistic pip-scale volatility, forex session dynamics, and tight spreads around 1.0850.',
    badge: 'FOREX',
    accent: 'sky',
    accentHex: '#0ea5e9',
    glowRgb: '14,165,233',
    points: EURUSD_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    type: SimulationType.GBM,
    preset: MarketPreset.EURUSD,
    v2: true,
    name: 'EUR/USD v2',
    description: 'TradingView-inspired professional interface — full-screen chart, floating order entry, slide-out settings, and tabbed trade management.',
    badge: 'PRO',
    accent: 'violet',
    accentHex: '#8b5cf6',
    glowRgb: '139,92,246',
    points: EURUSD_POINTS,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

export function SimulationMenu({ onSelect }: SimulationMenuProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">
          Quant<span className="text-indigo-400">Flow</span><span className="text-slate-300 font-light">Sim</span>
        </h1>
        <p className="text-slate-500 text-sm tracking-wide">Select a market simulation model to begin your session</p>
      </div>

      {/* Card Grid */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, idx) => {
          const isHovered = hoveredCard === idx;
          return (
            <button
              key={card.name}
              onClick={() => onSelect(card.type, card.preset, card.v2)}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
              className="relative text-left bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden transition-all duration-300 cursor-pointer"
              style={{
                transform: isHovered ? 'scale(1.02) translateY(-4px)' : 'scale(1) translateY(0)',
                borderColor: isHovered ? card.accentHex + '99' : undefined,
                boxShadow: isHovered ? `0 0 30px -5px rgba(${card.glowRgb},0.3)` : undefined,
              }}
            >
              {/* Radial glow overlay */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{
                  background: `radial-gradient(ellipse at top left, rgba(${card.glowRgb},0.08) 0%, transparent 60%)`,
                  opacity: isHovered ? 1 : 0,
                }}
              />

              {/* Top row: icon + badge */}
              <div className="flex items-center justify-between mb-4 relative">
                <div className="p-2 rounded-lg bg-slate-800/80">
                  {card.icon}
                </div>
                <span
                  className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-full border"
                  style={{ color: card.accentHex, borderColor: card.accentHex + '55', backgroundColor: card.accentHex + '33' }}
                >
                  {card.badge}
                </span>
              </div>

              {/* Title + description */}
              <div className="mb-4 relative">
                <h2 className="text-white font-bold text-lg mb-2">{card.name}</h2>
                <p className="text-slate-400 text-sm leading-relaxed">{card.description}</p>
              </div>

              {/* Sparkline */}
              <div className="mb-4 relative transition-opacity duration-300" style={{ opacity: isHovered ? 1 : 0.6 }}>
                <div className={isHovered ? 'animate-pulse' : ''}>
                  <Sparkline points={card.points} color={card.accentHex} />
                </div>
              </div>

              {/* Select CTA */}
              <div
                className="text-sm font-semibold transition-opacity duration-300 relative"
                style={{ color: card.accentHex, opacity: isHovered ? 1 : 0 }}
              >
                Select simulation →
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-10 text-slate-700 text-xs text-center">
        All models use deterministic tick simulation • No real financial data
      </p>
    </div>
  );
}
