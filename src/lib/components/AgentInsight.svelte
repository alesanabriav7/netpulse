<script lang="ts">
  import { insights } from '../stores/analysis'
  import type { Analysis } from '../../../shared/types'

  let items: Analysis[] = []
  insights.subscribe((v) => (items = v))

  const statusColors: Record<string, string> = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
  }
</script>

<div class="panel">
  <h3>AI Analysis</h3>
  <div class="insight-list">
    {#if items.length === 0}
      <div class="empty">No analysis data yet. Insights will appear after network tests run.</div>
    {:else}
      {#each [...items].reverse() as item}
        <div class="insight-item">
          <div class="insight-header">
            <span class="status-dot" style="background: {statusColors[item.status]}"></span>
            <span class="status-label" style="color: {statusColors[item.status]}">{item.status}</span>
            <span class="timestamp">{new Date(item.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="summary">{item.summary}</div>
          {#if item.root_cause}
            <div class="detail"><span class="detail-label">Cause:</span> {item.root_cause}</div>
          {/if}
          {#if item.recommendation}
            <div class="detail"><span class="detail-label">Fix:</span> {item.recommendation}</div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .panel {
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    padding: 20px;
  }
  h3 {
    color: #e0e0f0;
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  .insight-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 320px;
    overflow-y: auto;
  }
  .insight-list::-webkit-scrollbar {
    width: 6px;
  }
  .insight-list::-webkit-scrollbar-thumb {
    background: #2a2a3a;
    border-radius: 3px;
  }
  .empty {
    color: #6b6b80;
    font-size: 13px;
    text-align: center;
    padding: 24px 0;
  }
  .insight-item {
    padding: 12px;
    background: #0f0f14;
    border-radius: 8px;
    border: 1px solid #2a2a3a;
  }
  .insight-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .status-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .timestamp {
    color: #6b6b80;
    font-size: 11px;
    margin-left: auto;
    font-family: monospace;
  }
  .summary {
    color: #e0e0f0;
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 6px;
  }
  .detail {
    color: #a0a0b8;
    font-size: 12px;
    line-height: 1.4;
    margin-top: 4px;
  }
  .detail-label {
    color: #6b6b80;
    font-weight: 600;
  }
</style>
