<script lang="ts">
  import { insights } from '../stores/analysis'
  import { fixStatuses, applyFix } from '../stores/fixes'
  import type { Analysis, FixStatus } from '../../../shared/types'

  let items: Analysis[] = $state([])
  let statuses: Record<string, FixStatus> = $state({})
  let applying: Record<string, boolean> = $state({})

  insights.subscribe((v) => (items = v))
  fixStatuses.subscribe((v) => (statuses = v))

  const statusColors: Record<string, string> = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
  }

  const knownFixes: { id: string; label: string; keywords: string[] }[] = [
    { id: 'dns-cloudflare', label: 'Set DNS to Cloudflare', keywords: ['dns-cloudflare', 'dns cloudflare', 'cloudflare dns'] },
    { id: 'tcp-tuning', label: 'TCP Tuning', keywords: ['tcp-tuning', 'tcp tuning', 'delayed ack'] },
    { id: 'disable-awdl', label: 'Disable AWDL', keywords: ['disable-awdl', 'disable awdl', 'awdl'] },
    { id: 'disable-bluetooth', label: 'Disable Bluetooth', keywords: ['disable-bluetooth', 'disable bluetooth', 'bluetooth'] },
    { id: 'flush-dns', label: 'Flush DNS', keywords: ['flush-dns', 'flush dns', 'dns cache', 'stale cache'] },
    { id: 'restart-wifi', label: 'Restart Wi-Fi', keywords: ['restart-wifi', 'restart wifi', 'restart wi-fi', 'reset wireless'] },
  ]

  function extractFixes(text: string | null): { id: string; label: string }[] {
    if (!text) return []
    const lower = text.toLowerCase()
    return knownFixes.filter((f) => {
      if (statuses[f.id]?.applied) return false
      return f.keywords.some((kw) => lower.includes(kw))
    })
  }

  async function handleApply(fixId: string) {
    applying[fixId] = true
    try {
      await applyFix(fixId)
    } finally {
      applying[fixId] = false
    }
  }
</script>

<div class="panel">
  <h3>AI Analysis</h3>
  <div class="insight-list">
    {#if items.length === 0}
      <div class="empty">No analysis data yet. Insights will appear after network tests run.</div>
    {:else}
      {#each [...items].reverse() as item}
        {@const suggestedFixes = extractFixes(item.recommendation)}
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
          {#if suggestedFixes.length > 0}
            <div class="suggested-actions">
              {#each suggestedFixes as fix}
                <button
                  class="apply-btn"
                  disabled={applying[fix.id]}
                  onclick={() => handleApply(fix.id)}
                >
                  {#if applying[fix.id]}
                    Applying...
                  {:else}
                    Apply: {fix.label}
                  {/if}
                </button>
              {/each}
            </div>
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
  .suggested-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #2a2a3a;
  }
  .apply-btn {
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid #3b82f640;
    background: #3b82f615;
    color: #93b4f6;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .apply-btn:hover:not(:disabled) {
    background: #3b82f630;
    border-color: #3b82f6;
  }
  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
