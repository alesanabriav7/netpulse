<script lang="ts">
  import type { OverallStatus } from '../../../shared/types'

  let { label, score, status }: { label: string; score: number; status: OverallStatus } = $props()

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
</style>
