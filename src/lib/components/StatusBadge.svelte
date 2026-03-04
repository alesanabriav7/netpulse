<script lang="ts">
  import type { OverallStatus } from '../../../shared/types'

  let { status }: { status: OverallStatus } = $props()

  const colors: Record<OverallStatus, string> = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
  }

  const labels: Record<OverallStatus, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    critical: 'Critical',
  }
</script>

<span class="badge" style="background: {colors[status]}20; color: {colors[status]}; border-color: {colors[status]}40">
  <span class="dot" style="background: {colors[status]}"></span>
  {labels[status]}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
