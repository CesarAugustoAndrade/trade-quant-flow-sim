import React, { useState } from 'react';
import { Trade, TradeType, SessionStats } from '../../types';
import { TV, ChevronDown, ChevronUp, DownloadIcon, ClipboardIcon } from './ui';

interface TradesPanelProps {
  trades: Trade[];
  currentPrice: number;
  pipSize: number;
  pipValue: number;
  pricePrecision: number;
  sessionStats: SessionStats;
  currency?: string;  // '$' for forex, '€' for the DAX
  unitLabel?: string; // 'Pips' or 'Points'
  onSelectTrade: (trade: Trade | null) => void;
  onCloseTrade: (id: string) => void;
  onDownloadCSV: () => void;
}

// Bottom panel: positions / orders / history tables and the session journal
export function TradesPanel({
  trades, currentPrice, pipSize, pipValue, pricePrecision, sessionStats,
  currency = '$', unitLabel = 'Pips', onSelectTrade, onCloseTrade, onDownloadCSV,
}: TradesPanelProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'journal'>('positions');
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const pendingTrades = trades.filter(t => t.status === 'PENDING');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const filteredTrades = activeTab === 'positions' ? openTrades : activeTab === 'orders' ? pendingTrades : activeTab === 'history' ? closedTrades : [];
  const money = (v: number) => `${v < 0 ? '-' : ''}${currency}${Math.abs(v).toFixed(2)}`;

  return (
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
            { label: 'Largest Win', value: money(sessionStats.largestWin), color: '#089981' },
            { label: 'Largest Loss', value: money(Math.abs(sessionStats.largestLoss)), color: '#f23645' },
            { label: `Total ${unitLabel}`, value: sessionStats.totalPips.toFixed(1), color: sessionStats.totalPips >= 0 ? '#089981' : '#f23645' },
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
                      {trade.status === 'PENDING' ? 'PENDING' : `${currency}${livePnl!.toFixed(2)}`}
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
  );
}
