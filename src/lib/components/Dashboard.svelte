<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import StatusBadge from './StatusBadge.svelte'
  import ScoreCard from './ScoreCard.svelte'
  import MetricChart from './MetricChart.svelte'
  import AgentInsight from './AgentInsight.svelte'
  import FixPanel from './FixPanel.svelte'
  import SummaryPanel from './SummaryPanel.svelte'
  import Settings from './Settings.svelte'
  import { latestMetrics, metricsHistory, scores, overallStatus, initMetricsStore } from '../stores/metrics'
  import { initAnalysisStore } from '../stores/analysis'
  import { loadFixStatuses } from '../stores/fixes'
  import { initConfigStore } from '../stores/config'
  import type { Metrics, Scores, OverallStatus } from '../../../shared/types'

  let currentScores: Scores | null = $state(null)
  let currentStatus: OverallStatus | null = $state(null)
  let history: Metrics[] = $state([])
  let metrics: Metrics | null = $state(null)
  let running = $state(false)
  let settingsOpen = $state(false)
  let probeStep = $state<{ phase: string; detail: string } | null>(null)

  const unsubs: (() => void)[] = []

  onMount(() => {
    unsubs.push(initMetricsStore())
    unsubs.push(initAnalysisStore())
    unsubs.push(initConfigStore())
    loadFixStatuses()
    unsubs.push(scores.subscribe((v) => (currentScores = v)))
    unsubs.push(overallStatus.subscribe((v) => (currentStatus = v)))
    unsubs.push(metricsHistory.subscribe((v) => (history = v)))
    unsubs.push(latestMetrics.subscribe((v) => (metrics = v)))
    const progressUnsub = window.api.onProbeProgress((step) => {
      probeStep = step
      if (step.phase === 'done') {
        setTimeout(() => { probeStep = null }, 1500)
      }
    })
    unsubs.push(progressUnsub)
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

  function rateMetric(value: number | null, thresholds: [number, number, number], ascending: boolean): { label: string; color: string } {
    if (value === null) return { label: 'No data', color: '#4a4a5a' }
    const score = tier(value, thresholds, ascending)
    if (score < 0) return { label: 'No data', color: '#4a4a5a' }
    if (score >= 80) return { label: 'Excellent', color: '#22c55e' }
    if (score >= 60) return { label: 'Good', color: '#86efac' }
    if (score >= 40) return { label: 'Fair', color: '#f59e0b' }
    return { label: 'Poor', color: '#ef4444' }
  }

  let latencyRating = $derived(metrics ? rateMetric(metrics.ping_avg_ms, [50, 120, 250], false) : null)
  let jitterRating = $derived(metrics ? rateMetric(metrics.ping_jitter_ms, [15, 40, 80], false) : null)
  let lossRating = $derived(metrics ? rateMetric(metrics.packet_loss_pct, [0.5, 2, 5], false) : null)

  let dlRating = $derived(metrics ? rateMetric(metrics.dl_throughput_mbps, [50, 15, 5], true) : null)
  let ulRating = $derived(metrics ? rateMetric(metrics.ul_throughput_mbps, [10, 3, 1], true) : null)

  let throughputStats = $derived(() => {
    if (history.length === 0) return null
    const dls = history.map(m => m.dl_throughput_mbps).filter((v): v is number => v !== null)
    const uls = history.map(m => m.ul_throughput_mbps).filter((v): v is number => v !== null)
    if (dls.length === 0) return null
    return {
      dlMin: Math.min(...dls).toFixed(0),
      dlMax: Math.max(...dls).toFixed(0),
      dlAvg: (dls.reduce((a, b) => a + b, 0) / dls.length).toFixed(0),
      ulMin: Math.min(...uls).toFixed(0),
      ulMax: Math.max(...uls).toFixed(0),
      ulAvg: (uls.reduce((a, b) => a + b, 0) / uls.length).toFixed(0),
    }
  })

  function scoreStatus(score: number): OverallStatus {
    if (score >= 80) return 'healthy'
    if (score >= 50) return 'degraded'
    return 'critical'
  }

  function tier(value: number | null, thresholds: [number, number, number], ascending: boolean): number {
    if (value === null) return -1
    const [excellent, good, poor] = thresholds

    if (ascending) {
      if (value >= excellent) return 100
      if (value >= good) return 70 + 30 * (value - good) / (excellent - good)
      if (value >= poor) return 40 + 30 * (value - poor) / (good - poor)
      if (value > 0) return Math.max(5, 40 * value / poor)
      return 0
    } else {
      if (value <= excellent) return 100
      if (value <= good) return 70 + 30 * (good - value) / (good - excellent)
      if (value <= poor) return 40 + 30 * (poor - value) / (poor - good)
      return Math.max(5, 40 * Math.max(0, 1 - (value - poor) / poor))
    }
  }

  function fmt(v: number | null, unit: string): string {
    if (v === null) return 'N/A'
    return `${v % 1 === 0 ? v : v.toFixed(1)}${unit}`
  }

  let streamingBreakdown = $derived(metrics ? [
    { name: 'Download', value: fmt(metrics.dl_throughput_mbps, ' Mbps'), score: tier(metrics.dl_throughput_mbps, [50, 15, 5], true), weight: '40%' },
    { name: 'Jitter', value: fmt(metrics.ping_jitter_ms, ' ms'), score: tier(metrics.ping_jitter_ms, [15, 40, 80], false), weight: '25%' },
    { name: 'Loss', value: fmt(metrics.packet_loss_pct, '%'), score: tier(metrics.packet_loss_pct, [0.5, 2, 5], false), weight: '20%' },
    { name: 'Latency', value: fmt(metrics.ping_avg_ms, ' ms'), score: tier(metrics.ping_avg_ms, [50, 120, 250], false), weight: '15%' },
  ].filter(i => i.score >= 0) : [])

  let gamingBreakdown = $derived(metrics ? [
    { name: 'Latency', value: fmt(metrics.ping_avg_ms, ' ms'), score: tier(metrics.ping_avg_ms, [30, 75, 150], false), weight: '35%' },
    { name: 'Jitter', value: fmt(metrics.ping_jitter_ms, ' ms'), score: tier(metrics.ping_jitter_ms, [8, 20, 50], false), weight: '30%' },
    { name: 'Loss', value: fmt(metrics.packet_loss_pct, '%'), score: tier(metrics.packet_loss_pct, [0.5, 2, 5], false), weight: '25%' },
    { name: 'Download', value: fmt(metrics.dl_throughput_mbps, ' Mbps'), score: tier(metrics.dl_throughput_mbps, [15, 5, 3], true), weight: '10%' },
  ].filter(i => i.score >= 0) : [])

  let videocallsBreakdown = $derived(metrics ? [
    { name: 'Upload', value: fmt(metrics.ul_throughput_mbps, ' Mbps'), score: tier(metrics.ul_throughput_mbps, [10, 3, 1], true), weight: '25%' },
    { name: 'Download', value: fmt(metrics.dl_throughput_mbps, ' Mbps'), score: tier(metrics.dl_throughput_mbps, [15, 5, 2], true), weight: '20%' },
    { name: 'Jitter', value: fmt(metrics.ping_jitter_ms, ' ms'), score: tier(metrics.ping_jitter_ms, [15, 30, 60], false), weight: '25%' },
    { name: 'Latency', value: fmt(metrics.ping_avg_ms, ' ms'), score: tier(metrics.ping_avg_ms, [50, 100, 200], false), weight: '15%' },
    { name: 'Loss', value: fmt(metrics.packet_loss_pct, '%'), score: tier(metrics.packet_loss_pct, [1, 3, 7], false), weight: '15%' },
  ].filter(i => i.score >= 0) : [])

  let scoreSummary = $derived(() => {
    if (!currentScores || !metrics) return null

    const { streaming, gaming, videocalls } = currentScores
    const avg = Math.round((streaming + gaming + videocalls) / 3)

    const categories = [
      { name: 'Streaming', score: streaming },
      { name: 'Gaming', score: gaming },
      { name: 'Video Calls', score: videocalls },
    ]
    const weakest = categories.reduce((a, b) => a.score < b.score ? a : b)
    const strongest = categories.reduce((a, b) => a.score > b.score ? a : b)

    const issues: string[] = []
    if (metrics.ping_avg_ms != null && metrics.ping_avg_ms > 80) {
      issues.push(`high latency (${metrics.ping_avg_ms.toFixed(0)}ms)`)
    }
    if (metrics.ping_jitter_ms != null && metrics.ping_jitter_ms > 20) {
      issues.push(`unstable connection (${metrics.ping_jitter_ms.toFixed(0)}ms jitter)`)
    }
    if (metrics.packet_loss_pct != null && metrics.packet_loss_pct > 1) {
      issues.push(`packet loss (${metrics.packet_loss_pct.toFixed(1)}%)`)
    }
    if (metrics.dl_throughput_mbps != null && metrics.dl_throughput_mbps < 10) {
      issues.push(`slow download (${metrics.dl_throughput_mbps.toFixed(1)} Mbps)`)
    }
    if (metrics.ul_throughput_mbps != null && metrics.ul_throughput_mbps < 2) {
      issues.push(`slow upload (${metrics.ul_throughput_mbps.toFixed(1)} Mbps)`)
    }

    if (avg >= 85 && issues.length === 0) {
      return `Your network is excellent across the board — fast speeds, low latency, no issues detected.`
    }

    if (avg >= 70) {
      if (issues.length > 0) {
        return `Good overall, but ${weakest.name.toLowerCase()} is limited by ${issues.join(' and ')}.`
      }
      const allSimilar = strongest.score - weakest.score < 15
      if (allSimilar) {
        return `Network quality is good — all categories performing well.`
      }
      return `Best for ${strongest.name.toLowerCase()} (${strongest.score}). ${weakest.name} scores lower at ${weakest.score}.`
    }

    if (avg >= 50) {
      if (issues.length > 0) {
        return `Network is degraded — ${issues.join(', ')}. ${weakest.name} is most affected (${weakest.score}).`
      }
      return `Network performance is below average. ${weakest.name} most affected at ${weakest.score}.`
    }

    if (issues.length > 0) {
      return `Network quality is poor — ${issues.join(', ')}. Consider running a fix or checking your connection.`
    }
    return `Network quality is critically low across all categories.`
  })
</script>

<div class="dashboard">
  <header>
    <div class="title-row">
      <h1>NetPulse</h1>
      {#if currentStatus}
        <StatusBadge status={currentStatus} />
      {/if}
    </div>
    <div class="header-actions">
      <button class="icon-btn" onclick={() => settingsOpen = true} title="Settings">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16.2 12.2a1.4 1.4 0 00.3 1.5l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.5-.3 1.4 1.4 0 00-.85 1.3v.13a1.7 1.7 0 11-3.4 0v-.07a1.4 1.4 0 00-.9-1.3 1.4 1.4 0 00-1.5.3l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.3-1.5 1.4 1.4 0 00-1.3-.85H2.5a1.7 1.7 0 110-3.4h.07a1.4 1.4 0 001.3-.9 1.4 1.4 0 00-.3-1.5l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.5.3h.07a1.4 1.4 0 00.85-1.3V2.5a1.7 1.7 0 013.4 0v.07a1.4 1.4 0 00.85 1.3 1.4 1.4 0 001.5-.3l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.3 1.5v.07a1.4 1.4 0 001.3.85h.13a1.7 1.7 0 110 3.4h-.07a1.4 1.4 0 00-1.3.85z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      <button class="run-btn" class:running disabled={running} onclick={runTest}>
        {#if running}
          <span class="spinner"></span> Testing...
        {:else}
          Run Test Now
        {/if}
      </button>
    </div>
  </header>

  {#if running || probeStep}
    <div class="testing-banner">
      <div class="progress-steps">
        <div class="step" class:active={probeStep?.phase === 'ping'} class:done={probeStep && ['throughput', 'wifi', 'scoring', 'done'].includes(probeStep.phase)}>
          <div class="step-icon">{probeStep && ['throughput', 'wifi', 'scoring', 'done'].includes(probeStep.phase) ? '✓' : '1'}</div>
          <span>Ping</span>
        </div>
        <div class="step-line" class:done={probeStep && ['throughput', 'wifi', 'scoring', 'done'].includes(probeStep.phase)}></div>
        <div class="step" class:active={probeStep?.phase === 'throughput'} class:done={probeStep && ['wifi', 'scoring', 'done'].includes(probeStep.phase)}>
          <div class="step-icon">{probeStep && ['wifi', 'scoring', 'done'].includes(probeStep.phase) ? '✓' : '2'}</div>
          <span>Speed</span>
        </div>
        <div class="step-line" class:done={probeStep && ['wifi', 'scoring', 'done'].includes(probeStep.phase)}></div>
        <div class="step" class:active={probeStep?.phase === 'wifi'} class:done={probeStep && ['scoring', 'done'].includes(probeStep.phase)}>
          <div class="step-icon">{probeStep && ['scoring', 'done'].includes(probeStep.phase) ? '✓' : '3'}</div>
          <span>WiFi</span>
        </div>
        <div class="step-line" class:done={probeStep?.phase === 'done'}></div>
        <div class="step" class:active={probeStep?.phase === 'scoring'} class:done={probeStep?.phase === 'done'}>
          <div class="step-icon">{probeStep?.phase === 'done' ? '✓' : '4'}</div>
          <span>Score</span>
        </div>
      </div>
      <div class="progress-detail">
        {probeStep?.detail || 'Starting test...'}
      </div>
    </div>
  {/if}

  {#if currentScores}
    <section class="scores" class:testing={running}>
      <ScoreCard label="Streaming" score={currentScores.streaming} status={scoreStatus(currentScores.streaming)} breakdown={streamingBreakdown} />
      <ScoreCard label="Gaming" score={currentScores.gaming} status={scoreStatus(currentScores.gaming)} breakdown={gamingBreakdown} />
      <ScoreCard label="Video Calls" score={currentScores.videocalls} status={scoreStatus(currentScores.videocalls)} breakdown={videocallsBreakdown} />
    </section>
  {:else}
    <section class="scores empty-state">
      <div class="placeholder">Waiting for first network test...</div>
    </section>
  {/if}

  {#if scoreSummary()}
    <div class="score-summary">
      <p>{scoreSummary()}</p>
    </div>
  {/if}

  <section class="charts" class:testing={running}>
    <div class="chart-with-stats">
      <MetricChart title="Latency & Jitter (24h)" labels={chartLabels} datasets={latencyDatasets} />
      {#if metrics}
        <div class="metric-readouts">
          <div class="readout">
            <span class="readout-label">Latency</span>
            <span class="readout-value">{metrics.ping_avg_ms != null ? `${metrics.ping_avg_ms.toFixed(0)} ms` : '—'}</span>
            {#if latencyRating}<span class="readout-rating" style="color: {latencyRating.color}">{latencyRating.label}</span>{/if}
          </div>
          <div class="readout">
            <span class="readout-label">Jitter</span>
            <span class="readout-value">{metrics.ping_jitter_ms != null ? `${metrics.ping_jitter_ms.toFixed(1)} ms` : '—'}</span>
            {#if jitterRating}<span class="readout-rating" style="color: {jitterRating.color}">{jitterRating.label}</span>{/if}
          </div>
          <div class="readout">
            <span class="readout-label">Packet Loss</span>
            <span class="readout-value">{metrics.packet_loss_pct != null ? `${metrics.packet_loss_pct.toFixed(1)}%` : '—'}</span>
            {#if lossRating}<span class="readout-rating" style="color: {lossRating.color}">{lossRating.label}</span>{/if}
          </div>
        </div>
      {/if}
    </div>
    <div class="chart-with-stats">
      <MetricChart title="Throughput (24h)" labels={chartLabels} datasets={throughputDatasets} />
      {#if metrics}
        <div class="metric-readouts">
          <div class="readout">
            <span class="readout-label">Download</span>
            <span class="readout-value">{metrics.dl_throughput_mbps != null ? `${metrics.dl_throughput_mbps.toFixed(1)}` : '—'} <small class="readout-unit">Mbps</small></span>
            {#if dlRating}<span class="readout-rating" style="color: {dlRating.color}">{dlRating.label}</span>{/if}
          </div>
          <div class="readout">
            <span class="readout-label">Upload</span>
            <span class="readout-value">{metrics.ul_throughput_mbps != null ? `${metrics.ul_throughput_mbps.toFixed(1)}` : '—'} <small class="readout-unit">Mbps</small></span>
            {#if ulRating}<span class="readout-rating" style="color: {ulRating.color}">{ulRating.label}</span>{/if}
          </div>
          {#if throughputStats()}
            <div class="readout">
              <span class="readout-label">24h Range</span>
              <span class="readout-value range-value">{throughputStats()?.dlMin}–{throughputStats()?.dlMax} <small class="readout-unit">Mbps</small></span>
              <span class="readout-rating" style="color: #6b6b80">avg {throughputStats()?.dlAvg}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <section class="summary-section">
    <SummaryPanel />
  </section>

  <section class="bottom-row">
    <div class="bottom-left">
      <AgentInsight />
    </div>
    <div class="bottom-right">
      <FixPanel />
    </div>
  </section>

  <Settings bind:open={settingsOpen} />
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
  .summary-section {
    width: 100%;
  }
  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .bottom-left, .bottom-right {
    min-width: 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .icon-btn {
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #2a2a3a;
    background: transparent;
    color: #6b6b80;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .icon-btn:hover {
    color: #e0e0f0;
    background: #2a2a3a;
  }
  .testing-banner {
    padding: 16px 20px;
    background: #1a1a24;
    border: 1px solid #3b82f630;
    border-radius: 12px;
    animation: fadeIn 0.2s ease;
  }
  .progress-steps {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 10px;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #4a4a5a;
    font-size: 13px;
    font-weight: 500;
    transition: color 0.3s;
  }
  .step.active {
    color: #3b82f6;
  }
  .step.done {
    color: #22c55e;
  }
  .step-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    background: #2a2a3a;
    color: inherit;
    transition: all 0.3s;
  }
  .step.active .step-icon {
    background: #3b82f620;
    border: 1.5px solid #3b82f6;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .step.done .step-icon {
    background: #22c55e20;
    border: 1.5px solid #22c55e;
  }
  .step-line {
    flex: 1;
    height: 2px;
    background: #2a2a3a;
    margin: 0 8px;
    transition: background 0.3s;
  }
  .step-line.done {
    background: #22c55e;
  }
  .progress-detail {
    color: #6b6b80;
    font-size: 13px;
    text-align: center;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }
  .testing {
    opacity: 0.6;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .run-btn.running {
    border-color: #3b82f680;
  }
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #3b82f640;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .chart-with-stats {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .chart-with-stats > :first-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .metric-readouts {
    display: flex;
    gap: 0;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-top: none;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
    padding: 10px 16px;
  }
  .readout {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .readout-label {
    color: #6b6b80;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .readout-value {
    color: #e0e0f0;
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .readout-unit {
    font-size: 12px;
    font-weight: 400;
    color: #6b6b80;
  }
  .readout-rating {
    font-size: 11px;
    font-weight: 600;
  }
  .range-value {
    font-size: 15px;
  }
  .score-summary {
    padding: 12px 16px;
    background: #1a1a2408;
    border-radius: 8px;
  }
  .score-summary p {
    margin: 0;
    color: #a0a0b8;
    font-size: 14px;
    line-height: 1.5;
  }
</style>
