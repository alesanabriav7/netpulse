<script lang="ts">
  import type { Summary } from '../../../shared/types'

  let summaries: Summary[] = $state([])
  let expanded = $state(false)
  let generating = $state(false)

  async function loadSummaries() {
    summaries = await window.api.getSummaries()
  }

  async function generate() {
    generating = true
    try {
      await window.api.generateSummary()
      await loadSummaries()
    } finally {
      generating = false
    }
  }

  $effect(() => {
    loadSummaries()
  })

  let latest = $derived(summaries[0] ?? null)

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function scoreColor(score: number): string {
    if (score >= 80) return '#22c55e'
    if (score >= 50) return '#f59e0b'
    return '#ef4444'
  }
</script>

<div class="panel">
  <div class="panel-header">
    <h3>24h Summary</h3>
    <button class="gen-btn" onclick={generate} disabled={generating}>
      {generating ? 'Generating...' : 'Generate'}
    </button>
  </div>

  {#if latest}
    <div class="summary-card">
      <div class="score-row">
        <div class="score-item">
          <span class="score-label">Streaming</span>
          <span class="score-value" style="color: {scoreColor(latest.avg_streaming)}">{latest.avg_streaming}</span>
        </div>
        <div class="score-item">
          <span class="score-label">Gaming</span>
          <span class="score-value" style="color: {scoreColor(latest.avg_gaming)}">{latest.avg_gaming}</span>
        </div>
        <div class="score-item">
          <span class="score-label">Video</span>
          <span class="score-value" style="color: {scoreColor(latest.avg_videocalls)}">{latest.avg_videocalls}</span>
        </div>
      </div>

      {#if latest.degraded_count > 0}
        <div class="degraded-count">
          {latest.degraded_count} degraded event{latest.degraded_count === 1 ? '' : 's'}
          {#if latest.most_common_cause}
            &mdash; {latest.most_common_cause}
          {/if}
        </div>
      {/if}

      {#if latest.narrative}
        <p class="narrative">{latest.narrative}</p>
      {/if}

      <div class="meta">
        {formatDate(latest.period_start)} — {formatDate(latest.period_end)}
      </div>
    </div>

    {#if summaries.length > 1}
      <button class="expand-btn" onclick={() => expanded = !expanded}>
        {expanded ? 'Hide history' : `Show ${summaries.length - 1} more`}
      </button>

      {#if expanded}
        <div class="history">
          {#each summaries.slice(1) as s}
            <div class="history-item">
              <div class="history-scores">
                <span style="color: {scoreColor(s.avg_streaming)}">{s.avg_streaming}</span> /
                <span style="color: {scoreColor(s.avg_gaming)}">{s.avg_gaming}</span> /
                <span style="color: {scoreColor(s.avg_videocalls)}">{s.avg_videocalls}</span>
              </div>
              <div class="history-meta">{formatDate(s.period_start)}</div>
              {#if s.narrative}
                <p class="history-narrative">{s.narrative}</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {:else}
    <div class="empty">No summaries yet. Click "Generate" to create one.</div>
  {/if}
</div>

<style>
  .panel {
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    padding: 20px;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h3 {
    color: #e0e0f0;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }
  .gen-btn {
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid #2a2a3a;
    background: #2a2a3a;
    color: #a0a0b0;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .gen-btn:hover:not(:disabled) { background: #3a3a4a; color: #e0e0f0; }
  .gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .score-row {
    display: flex;
    gap: 16px;
  }
  .score-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .score-label {
    color: #6b6b80;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .score-value {
    font-size: 22px;
    font-weight: 700;
  }
  .degraded-count {
    color: #f59e0b;
    font-size: 12px;
    background: #f59e0b10;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .narrative {
    color: #c0c0d0;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }
  .meta {
    color: #4a4a5a;
    font-size: 11px;
  }
  .expand-btn {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
    margin-top: 8px;
  }
  .expand-btn:hover { text-decoration: underline; }
  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #2a2a3a;
  }
  .history-item {
    padding: 8px;
    background: #0f0f14;
    border-radius: 6px;
  }
  .history-scores {
    font-size: 14px;
    font-weight: 600;
  }
  .history-meta {
    color: #4a4a5a;
    font-size: 11px;
    margin-top: 2px;
  }
  .history-narrative {
    color: #8b8ba0;
    font-size: 12px;
    margin: 4px 0 0 0;
    line-height: 1.4;
  }
  .empty {
    color: #6b6b80;
    font-size: 13px;
    text-align: center;
    padding: 20px;
  }
</style>
