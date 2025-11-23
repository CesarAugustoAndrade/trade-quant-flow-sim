
import React from 'react';
import { Trade, TradeType } from '../types';

interface TradeDetailsModalProps {
  trade: Trade | null;
  onClose: () => void;
}

export const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({ trade, onClose }) => {
  if (!trade) return null;

  const isLong = trade.type === TradeType.LONG;
  const isClosed = trade.status === 'CLOSED';
  const pnlColor = (trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-[400px] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-lg ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
              {trade.type}
            </span>
            <span className="text-slate-500 text-xs font-mono">#{trade.id}</span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Execution Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <span className="text-[10px] uppercase text-slate-500 tracking-wider block mb-1">Entry Price</span>
              <span className="font-mono text-slate-200 text-lg">{trade.entryPrice.toFixed(2)}</span>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <span className="text-[10px] uppercase text-slate-500 tracking-wider block mb-1">Result (PnL)</span>
              {isClosed ? (
                <span className={`font-mono text-lg font-bold ${pnlColor}`}>
                  ${trade.pnl?.toFixed(2)}
                </span>
              ) : (
                <span className="text-amber-400 text-sm font-mono italic">TRADE OPEN</span>
              )}
            </div>
          </div>

          {/* Technical Snapshot */}
          {trade.snapshot ? (
            <div className="border-t border-slate-700 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                Technical State @ Entry
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 rounded hover:bg-slate-800 transition-colors">
                  <span className="text-slate-400">EMA (200)</span>
                  <span className="font-mono text-yellow-400">{trade.snapshot.ema.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center p-2 rounded hover:bg-slate-800 transition-colors">
                  <span className="text-slate-400">MACD Value</span>
                  <div className="text-right font-mono text-xs">
                     <span className="text-blue-400 mr-2">M: {trade.snapshot.macd.macd.toFixed(2)}</span>
                     <span className="text-orange-400">S: {trade.snapshot.macd.signal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-2 rounded hover:bg-slate-800 transition-colors">
                  <span className="text-slate-400">Histogram</span>
                  <span className={`font-mono ${trade.snapshot.macd.histogram >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {trade.snapshot.macd.histogram.toFixed(3)}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Momentum</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-900 border border-slate-700
                    ${trade.snapshot.macd.trend.includes('Positive') ? 'text-teal-400' : 'text-red-400'}
                  `}>
                    {trade.snapshot.macd.trend}
                  </span>
                </div>
              </div>
            </div>
          ) : (
             <div className="text-center text-slate-600 text-xs py-4 italic">
                Snapshot data unavailable for this trade.
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-800/30 p-4 text-center border-t border-slate-700">
           <span className="text-[10px] text-slate-500">
             Entry Time: {new Date(trade.entryTime * 1000).toLocaleTimeString()}
           </span>
        </div>

      </div>
    </div>
  );
};
