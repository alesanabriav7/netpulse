<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'
  import type { ChartDataset } from 'chart.js'

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

  let { title, labels, datasets }: { title: string; labels: string[]; datasets: ChartDataset<'line'>[] } = $props()

  let canvas: HTMLCanvasElement
  let chart: Chart<'line'> | null = null

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          x: {
            ticks: { color: '#6b6b80', maxTicksLimit: 8 },
            grid: { color: '#2a2a3a' },
          },
          y: {
            ticks: { color: '#6b6b80' },
            grid: { color: '#2a2a3a' },
          },
        },
        plugins: {
          legend: { labels: { color: '#a0a0b8' } },
          tooltip: {
            backgroundColor: '#1a1a24',
            borderColor: '#2a2a3a',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#a0a0b8',
          },
        },
      },
    })
  })

  $effect(() => {
    if (chart) {
      chart.data.labels = labels
      chart.data.datasets = datasets
      chart.update('none')
    }
  })

  onDestroy(() => {
    chart?.destroy()
  })
</script>

<div class="chart-container">
  <h3>{title}</h3>
  <div class="chart-wrapper">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .chart-container {
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    padding: 20px;
  }
  h3 {
    color: #e0e0f0;
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 12px 0;
  }
  .chart-wrapper {
    position: relative;
    height: 220px;
  }
</style>
