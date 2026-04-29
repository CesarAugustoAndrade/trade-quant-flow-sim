import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'quantflow.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id             TEXT PRIMARY KEY,
    type           TEXT NOT NULL CHECK(type IN ('LONG','SHORT')),
    status         TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED','PENDING')),
    entry_price    REAL NOT NULL,
    entry_time     INTEGER NOT NULL,
    close_price    REAL,
    close_time     INTEGER,
    pnl            REAL,
    stop_loss      REAL,
    take_profit    REAL,
    exit_reason    TEXT CHECK(exit_reason IN ('MANUAL','TP','SL')),
    market_preset  TEXT NOT NULL,
    sim_type       TEXT NOT NULL,
    session_label  TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trade_snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id            TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    snapshot_type       TEXT NOT NULL CHECK(snapshot_type IN ('ENTRY','EXIT')),
    ema1                REAL,
    ema2                REAL,
    ema3                REAL,
    macd_value          REAL,
    macd_signal         REAL,
    macd_histogram      REAL,
    macd_trend          TEXT,
    daily_bias_text     TEXT,
    ema1h_trend         TEXT,
    macd_vs_zero        REAL,
    macd_vs_signal      REAL,
    histogram_rising    INTEGER,
    divergence          TEXT,
    rsi15               REAL,
    hist5_rising        INTEGER,
    hist3_rising        INTEGER,
    atr                 REAL,
    drift_label         TEXT,
    drift_pct           REAL,
    macd_fast           INTEGER,
    macd_slow           INTEGER,
    macd_signal_period  INTEGER,
    ema1h_fast          INTEGER,
    ema1h_slow          INTEGER,
    atr_period          INTEGER,
    rsi_len             INTEGER,
    rsi_value           REAL,
    rsi_signal          REAL,
    rsi_zone            TEXT,
    current_atr         REAL,
    ema1_period         INTEGER,
    ema2_period         INTEGER,
    ema3_period         INTEGER,
    UNIQUE(trade_id, snapshot_type)
  );

  CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
  CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
  CREATE INDEX IF NOT EXISTS idx_snapshots_trade_id ON trade_snapshots(trade_id);
`);

export default db;
