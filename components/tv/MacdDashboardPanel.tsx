import React from 'react';
import { MacdDashboardData } from '../../types';

function DashRow({ label, children, lbl, row, txtL }: { label: string; children: React.ReactNode; lbl: string; row: string; txtL: string }) {
  return (
    <div className="flex items-center" style={{ borderBottom: '1px solid #ffffff08' }}>
      <div className="flex-1 px-2 py-1 text-[9px] truncate" style={{ background: lbl, color: txtL }}>{label}</div>
      <div className="px-2 py-1 text-right text-[10px]" style={{ background: row, minWidth: '80px' }}>{children}</div>
    </div>
  );
}

// precision: decimals for MACD values and ATR (5 for EUR/USD, ~2 for an index)
export function MacdDashboardPanel({ data, precision = 5 }: { data: MacdDashboardData; precision?: number }) {
  const hdr = '#0f3460';
  const lbl = '#1a1a2e';
  const row = '#16213e';
  const txtL = '#8899aa';
  const g = '#00ff00';
  const r = '#ff0000';
  const rsiSuffix = data.rsi15 > 70 ? '  OB' : data.rsi15 < 30 ? '  OS' : '';
  return (
    <div className="flex flex-col text-[10px] font-mono" style={{ background: '#0a0a1a' }}>
      {/* Header */}
      <div className="px-2 py-1 text-center font-bold tracking-wider" style={{ background: hdr, color: '#fff', fontSize: '9px' }}>
        MACD DASHBOARD <span style={{ color: '#8899aa', fontWeight: 'normal' }}>
          (15m: {data.macdParams.fast}/{data.macdParams.slow}/{data.macdParams.signal})
        </span>{' '}
        <span style={{ color: '#00d2ff' }}>◉</span> CLOSED
      </div>

      {/* Row 1 — Daily Bias */}
      <DashRow label="Daily Bias" lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.dailyBiasColor }}>{data.dailyBiasText}</span>
      </DashRow>

      {/* Row 2 — 1H EMA trend */}
      <DashRow label={`1H EMA ${data.ema1hParams.fast} vs ${data.ema1hParams.slow}`} lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.ema1hTrend === 'BULLISH' ? g : r }}>{data.ema1hTrend}</span>
      </DashRow>

      {/* Row 3 — MACD vs Zero */}
      <DashRow label="MACD vs Zero" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.macdVsZero >= 0 ? g : r }}>{data.macdVsZero.toFixed(precision)}</span>
      </DashRow>

      {/* Row 4 — MACD vs Signal */}
      <DashRow label="MACD vs Signal" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.macdVsSignal >= 0 ? g : r }}>{data.macdVsSignal.toFixed(precision)}</span>
      </DashRow>

      {/* Row 5 — Histogram */}
      <DashRow label="Histogram" lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.histogramRising ? g : r }}>
          {data.histogramRising ? '▲ CRESCENT' : '▼ DECRESCENT'}
        </span>
      </DashRow>

      {/* Row 6 — RSI Divergence */}
      <DashRow label="RSI Divergence (200 bars)" lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.divergence === 'None' ? '#888' : data.divergence.includes('BULL') ? g : r }}>
          {data.divergence}
        </span>
      </DashRow>

      {/* Row 7 — RSI (15m) */}
      <DashRow label={`RSI (${data.rsiLen}) — 15m`} lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: data.rsiColor }}>{data.rsi15.toFixed(2)}{rsiSuffix}</span>
      </DashRow>

      {/* Row 8 — 5m Histogram */}
      <DashRow label="Histogram — 5m" lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.hist5Rising ? g : r }}>
          {data.hist5Rising ? '▲ CRESCENT' : '▼ DECRESCENT'}
        </span>
      </DashRow>

      {/* Row 9 — 3m Histogram */}
      <DashRow label="Histogram — 3m" lbl={lbl} row={row} txtL={txtL}>
        <span className="font-bold" style={{ color: data.hist3Rising ? g : r }}>
          {data.hist3Rising ? '▲ CRESCENT' : '▼ DECRESCENT'}
        </span>
      </DashRow>

      {/* Row 10 — ATR */}
      <DashRow label={`ATR (${data.atrPeriod}) — 1m`} lbl={lbl} row={row} txtL={txtL}>
        <span style={{ color: '#00d2ff' }}>{data.atr.toFixed(precision)}</span>
      </DashRow>

      {/* Separator */}
      <div style={{ height: '2px', background: hdr }} />

      {/* Drift Score */}
      <div className="flex items-center justify-between px-2 py-2" style={{ background: hdr }}>
        <span className="font-bold uppercase" style={{ color: '#fff', fontSize: '11px' }}>DRIFT</span>
        <span className="font-bold" style={{ color: data.driftColor, fontSize: '11px' }}>
          {data.driftLabel}  {data.driftPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
