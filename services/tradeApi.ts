const API_BASE = '/api';

async function apiCall<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      console.warn(`[TradeAPI] ${res.status} ${res.statusText} for ${path}`);
      return null;
    }
    return res.json();
  } catch {
    // Server not running — silently degrade
    return null;
  }
}

export interface TradeCreatePayload {
  id: string;
  type: 'LONG' | 'SHORT';
  status: 'OPEN' | 'PENDING';
  entryPrice: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
  marketPreset: string;
  simType: string;
  sessionLabel?: string;
  snapshot: {
    ema1: number;
    ema2: number;
    ema3: number;
    macd: { macd: number; signal: number; histogram: number; trend: string };
    macdDashboard: any;
    rsiDashboard: any;
    currentAtr: number;
    emaPeriods: { ema1: number; ema2: number; ema3: number };
  };
}

export interface TradeClosePayload {
  status: 'CLOSED';
  closePrice: number;
  closeTime: number;
  pnl: number;
  exitReason: 'MANUAL' | 'TP' | 'SL';
  exitSnapshot?: TradeCreatePayload['snapshot'];
}

export const tradeApi = {
  create: (payload: TradeCreatePayload) =>
    apiCall('/trades', { method: 'POST', body: JSON.stringify(payload) }),

  close: (id: string, payload: TradeClosePayload) =>
    apiCall(`/trades/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiCall(`/trades${qs}`);
  },

  get: (id: string) => apiCall(`/trades/${id}`),

  delete: (id: string) => apiCall(`/trades/${id}`, { method: 'DELETE' }),

  health: () => apiCall<{ ok: boolean; db: boolean }>('/health'),
};
