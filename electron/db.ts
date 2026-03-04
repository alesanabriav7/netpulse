import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { Metrics, Analysis } from '@shared/types'

let db: Database.Database

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'netpulse.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      ping_avg_ms REAL, ping_jitter_ms REAL, packet_loss_pct REAL,
      dl_throughput_mbps REAL, ul_throughput_mbps REAL,
      dl_responsiveness_rpm INTEGER, ul_responsiveness_rpm INTEGER,
      dl_latency_ms REAL, ul_latency_ms REAL,
      wifi_channel TEXT, wifi_noise_dbm INTEGER, wifi_rssi_dbm INTEGER,
      wifi_tx_rate_mbps INTEGER, awdl_active BOOLEAN,
      score_streaming INTEGER, score_gaming INTEGER, score_videocalls INTEGER,
      raw_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);

    CREATE TABLE IF NOT EXISTS analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      metric_id INTEGER REFERENCES metrics(id),
      status TEXT NOT NULL CHECK(status IN ('healthy','degraded','critical')),
      summary TEXT NOT NULL,
      root_cause TEXT,
      recommendation TEXT
    );
  `)
}

export function insertMetrics(m: Metrics): number {
  const stmt = db.prepare(`
    INSERT INTO metrics (
      timestamp, ping_avg_ms, ping_jitter_ms, packet_loss_pct,
      dl_throughput_mbps, ul_throughput_mbps,
      dl_responsiveness_rpm, ul_responsiveness_rpm,
      dl_latency_ms, ul_latency_ms,
      wifi_channel, wifi_noise_dbm, wifi_rssi_dbm, wifi_tx_rate_mbps,
      awdl_active, score_streaming, score_gaming, score_videocalls, raw_json
    ) VALUES (
      @timestamp, @ping_avg_ms, @ping_jitter_ms, @packet_loss_pct,
      @dl_throughput_mbps, @ul_throughput_mbps,
      @dl_responsiveness_rpm, @ul_responsiveness_rpm,
      @dl_latency_ms, @ul_latency_ms,
      @wifi_channel, @wifi_noise_dbm, @wifi_rssi_dbm, @wifi_tx_rate_mbps,
      @awdl_active, @score_streaming, @score_gaming, @score_videocalls, @raw_json
    )
  `)
  const result = stmt.run({
    timestamp: m.timestamp,
    ping_avg_ms: m.ping_avg_ms,
    ping_jitter_ms: m.ping_jitter_ms,
    packet_loss_pct: m.packet_loss_pct,
    dl_throughput_mbps: m.dl_throughput_mbps,
    ul_throughput_mbps: m.ul_throughput_mbps,
    dl_responsiveness_rpm: m.dl_responsiveness_rpm,
    ul_responsiveness_rpm: m.ul_responsiveness_rpm,
    dl_latency_ms: m.dl_latency_ms,
    ul_latency_ms: m.ul_latency_ms,
    wifi_channel: m.wifi_channel,
    wifi_noise_dbm: m.wifi_noise_dbm,
    wifi_rssi_dbm: m.wifi_rssi_dbm,
    wifi_tx_rate_mbps: m.wifi_tx_rate_mbps,
    awdl_active: m.awdl_active != null ? (m.awdl_active ? 1 : 0) : null,
    score_streaming: m.score_streaming,
    score_gaming: m.score_gaming,
    score_videocalls: m.score_videocalls,
    raw_json: m.raw_json
  })
  return result.lastInsertRowid as number
}

function rowToMetrics(row: Record<string, unknown>): Metrics {
  return {
    ...row,
    awdl_active: row.awdl_active != null ? Boolean(row.awdl_active) : null
  } as Metrics
}

export function getLatestMetrics(): Metrics | null {
  const row = db.prepare('SELECT * FROM metrics ORDER BY id DESC LIMIT 1').get() as Record<string, unknown> | undefined
  return row ? rowToMetrics(row) : null
}

export function getMetricsRange(from: string, to: string): Metrics[] {
  const rows = db.prepare(
    'SELECT * FROM metrics WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).all(from, to) as Record<string, unknown>[]
  return rows.map(rowToMetrics)
}

export function insertAnalysis(a: Omit<Analysis, 'id' | 'timestamp'>): number {
  const stmt = db.prepare(`
    INSERT INTO analysis (metric_id, status, summary, root_cause, recommendation)
    VALUES (@metric_id, @status, @summary, @root_cause, @recommendation)
  `)
  const result = stmt.run(a)
  return result.lastInsertRowid as number
}

export function getAnalysis(): Analysis[] {
  return db.prepare('SELECT * FROM analysis ORDER BY id DESC LIMIT 50').all() as Analysis[]
}

export function cleanupOldData(retentionDays = 90): void {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('DELETE FROM analysis WHERE timestamp < ?').run(cutoff)
  db.prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoff)
}
