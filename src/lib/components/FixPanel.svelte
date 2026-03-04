<script lang="ts">
  import { fixStatuses, loadFixStatuses, applyFix } from '../stores/fixes'
  import type { FixStatus } from '../../../shared/types'

  let statuses: Record<string, FixStatus> = $state({})
  let loading: Record<string, boolean> = $state({})

  fixStatuses.subscribe((v) => (statuses = v))

  const fixes = [
    { id: 'flush-dns', label: 'Flush DNS Cache', description: 'Clear stale DNS entries that may slow lookups' },
    { id: 'disable-awdl', label: 'Disable AWDL', description: 'Turn off AirDrop/AirPlay wireless interface to reduce Wi-Fi interference' },
    { id: 'optimize-buffers', label: 'Optimize Network Buffers', description: 'Tune TCP buffer sizes for better throughput' },
  ]

  async function handleApply(fixId: string) {
    loading[fixId] = true
    try {
      await applyFix(fixId)
    } finally {
      loading[fixId] = false
    }
  }
</script>

<div class="panel">
  <h3>Quick Fixes</h3>
  <div class="fix-list">
    {#each fixes as fix}
      {@const status = statuses[fix.id]}
      <div class="fix-item">
        <div class="fix-info">
          <div class="fix-label">{fix.label}</div>
          <div class="fix-desc">{fix.description}</div>
          {#if status?.lastResult}
            <div class="fix-result" class:success={status.lastResult.success} class:failure={!status.lastResult.success}>
              {status.lastResult.message}
            </div>
          {/if}
        </div>
        <button
          class="fix-btn"
          class:applied={status?.applied}
          disabled={loading[fix.id]}
          onclick={() => handleApply(fix.id)}
        >
          {#if loading[fix.id]}
            ...
          {:else if status?.applied}
            Applied
          {:else}
            Apply
          {/if}
        </button>
      </div>
    {/each}
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
  .fix-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fix-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    background: #0f0f14;
    border-radius: 8px;
    border: 1px solid #2a2a3a;
  }
  .fix-info {
    flex: 1;
    min-width: 0;
  }
  .fix-label {
    color: #e0e0f0;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .fix-desc {
    color: #6b6b80;
    font-size: 12px;
    line-height: 1.4;
  }
  .fix-result {
    font-size: 11px;
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .fix-result.success {
    color: #22c55e;
    background: #22c55e10;
  }
  .fix-result.failure {
    color: #ef4444;
    background: #ef444410;
  }
  .fix-btn {
    flex-shrink: 0;
    padding: 6px 16px;
    border-radius: 6px;
    border: 1px solid #2a2a3a;
    background: #2a2a3a;
    color: #e0e0f0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .fix-btn:hover:not(:disabled) {
    background: #3a3a4a;
  }
  .fix-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .fix-btn.applied {
    background: #22c55e20;
    color: #22c55e;
    border-color: #22c55e40;
  }
</style>
