-- Database Schema for Offline Personal Financial Intelligence Engine
-- Stores transactions, confidence logs, correction history, and ML metadata

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    merchant_name TEXT,
    amount REAL NOT NULL,
    transaction_type TEXT,
    timestamp DATETIME,
    category TEXT,
    confidence REAL,
    ocr_confidence REAL,
    layout_confidence REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ocr_metadata (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    raw_text TEXT,
    detected_items INTEGER,
    processing_time_ms INTEGER,
    paddle_ocr_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS correction_history (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    user_id TEXT NOT NULL,
    field_corrected TEXT,
    original_value TEXT,
    corrected_value TEXT,
    correction_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ml_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    prediction_type TEXT,
    predicted_value REAL,
    actual_value REAL,
    confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS anomaly_flags (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    risk_score REAL,
    z_score REAL,
    reason TEXT,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS healing_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_type TEXT,
    correction_type TEXT,
    pattern_identified TEXT,
    frequency INTEGER,
    applied BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    metric_name TEXT,
    metric_value REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_confidence ON transactions(confidence);
CREATE INDEX IF NOT EXISTS idx_anomaly_user ON anomaly_flags(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_corrections_user ON correction_history(user_id, created_at);
