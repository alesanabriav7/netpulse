<script lang="ts">
  import type { OverallStatus } from '../../../shared/types'

  interface BreakdownItem {
    name: string
    value: string
    score: number
    weight: string
  }

  let { label, score, status, breakdown = [] }: {
    label: string; score: number; status: OverallStatus; breakdown?: BreakdownItem[]
  } = $props()

  const colors: Record<OverallStatus, string> = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
  }

  const radius = 40
  const circumference = 2 * Math.PI * radius
  let dashoffset = $derived(circumference - (score / 100) * circumference)
  let color = $derived(colors[status])
</script>

<div class="card">
  <svg width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r={radius} fill="none" stroke="#2a2a3a" stroke-width="6" />
    <circle
      cx="50" cy="50" r={radius}
      fill="none"
      stroke={color}
      stroke-width="6"
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashoffset}
      transform="rotate(-90 50 50)"
    />
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="white" font-size="22" font-family="system-ui" font-weight="700">
      {score}
    </text>
  </svg>
  <div class="label">{label}</div>
  <div class="status" style="color: {color}">{status}</div>
  {#if breakdown.length > 0}
    <div class="breakdown">
      {#each breakdown as item}
        <div class="breakdown-row">
          <span class="bk-name">{item.name}</span>
          <span class="bk-value">{item.value}</span>
          <div class="bk-bar-container">
            <div class="bk-bar" style="width: {item.score}%; background: {item.score >= 80 ? '#22c55e' : item.score >= 50 ? '#f59e0b' : '#ef4444'}"></div>
          </div>
          <span class="bk-weight">{item.weight}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card {
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .label {
    color: #a0a0b8;
    font-size: 14px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status {
    font-size: 13px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .breakdown {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid #2a2a3a;
  }
  .breakdown-row {
    display: grid;
    grid-template-columns: 60px 52px 1fr 32px;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }
  .bk-name {
    color: #6b6b80;
    white-space: nowrap;
  }
  .bk-value {
    color: #a0a0b8;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .bk-bar-container {
    height: 4px;
    background: #2a2a3a;
    border-radius: 2px;
    overflow: hidden;
  }
  .bk-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }
  .bk-weight {
    color: #4a4a5a;
    font-size: 10px;
    text-align: right;
  }
</style>
