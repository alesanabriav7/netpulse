<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import StatusBadge from './StatusBadge.svelte'
  import ScoreCard from './ScoreCard.svelte'
  import MetricChart from './MetricChart.svelte'
  import AgentInsight from './AgentInsight.svelte'
  import FixPanel from './FixPanel.svelte'
  import { latestMetrics, metricsHistory, scores, overallStatus, initMetricsStore } from '../stores/metrics'
  import { initAnalysisStore } from '../stores/analysis'
  import { loadFixStatuses } from '../stores/fixes'
  import type { Metrics, Scores, OverallStatus } from '../../../shared/types'

  let currentScores: Scores | null = $state(null)
  let currentStatus: OverallStatus | null = $state(null)
  let history: Metrics[] = $state([])
  let running = $state(false)

  const unsubs: (() => void)[] = []

  onMount(() => {
    unsubs.push(initMetricsStore())
    unsubs.push(initAnalysisStore())
    loadFixStatuses()
    unsubs.push(scores.subscribe((v) => (currentScores = v)))
    unsubs.push(overallStatus.subscribe((v) => (currentStatus = v)))
    unsubs.push(metricsHistory.subscribe((v) => (history = v)))
  })

  onDestroy(() => {
    unsubs.forEach((u) => u())
  })

  async function runTest() {
    running = true
    try {
      await window.api.runProbeNow()
    } finally {
      running = false
    }
  }

  function formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  let chartLabels = $derived(history.map((m) => formatTime(m.timestamp)))

  let latencyDatasets = $derived([
    {
      label: 'Latency (ms)',
      data: history.map((m) => m.ping_avg_ms ?? 0),
      borderColor: '#8b5cf6',
      backgroundColor: '#8b5cf620',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    },
    {
      label: 'Jitter (ms)',
      data: history.map((m) => m.ping_jitter_ms ?? 0),
      borderColor: '#f59e0b',
      backgroundColor: '#f59e0b20',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    },
  ])

  let throughputDatasets = $derived([
    {
      label: 'Download (Mbps)',
      data: history.map((m) => m.dl_throughput_mbps ?? 0),
      borderColor: '#22c55e',
      backgroundColor: '#22c55e20',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    },
    {
      label: 'Upload (Mbps)',
      data: history.map((m) => m.ul_throughput_mbps ?? 0),
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f620',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
    },
  ])

  function scoreStatus(score: number): OverallStatus {
    if (score >= 80) return 'healthy'
    if (score >= 50) return 'degraded'
    return 'critical'
  }
</script>

<div class="dashboard">
  <header>
    <div class="title-row">
      <h1>NetPulse</h1>
      {#if currentStatus}
        <StatusBadge status={currentStatus} />
      {/if}
    </div>
    <button class="run-btn" disabled={running} onclick={runTest}>
      {running ? 'Testing...' : 'Run Test Now'}
    </button>
  </header>

  {#if currentScores}
    <section class="scores">
      <ScoreCard label="Streaming" score={currentScores.streaming} status={scoreStatus(currentScores.streaming)} />
      <ScoreCard label="Gaming" score={currentScores.gaming} status={scoreStatus(currentScores.gaming)} />
      <ScoreCard label="Video Calls" score={currentScores.videocalls} status={scoreStatus(currentScores.videocalls)} />
    </section>
  {:else}
    <section class="scores empty-state">
      <div class="placeholder">Waiting for first network test...</div>
    </section>
  {/if}

  <section class="charts">
    <MetricChart title="Latency & Jitter (24h)" labels={chartLabels} datasets={latencyDatasets} />
    <MetricChart title="Throughput (24h)" labels={chartLabels} datasets={throughputDatasets} />
  </section>

  <section class="bottom-row">
    <div class="bottom-left">
      <AgentInsight />
    </div>
    <div class="bottom-right">
      <FixPanel />
    </div>
  </section>
</div>

<style>
  .dashboard {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  h1 {
    color: #fff;
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }
  .run-btn {
    padding: 8px 20px;
    border-radius: 8px;
    border: 1px solid #3b82f6;
    background: #3b82f620;
    color: #3b82f6;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .run-btn:hover:not(:disabled) {
    background: #3b82f640;
  }
  .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .scores {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .empty-state {
    display: flex;
    justify-content: center;
  }
  .placeholder {
    color: #6b6b80;
    font-size: 14px;
    text-align: center;
    padding: 40px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    width: 100%;
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .bottom-left, .bottom-right {
    min-width: 0;
  }
</style>
