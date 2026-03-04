<script lang="ts">
  import { appConfig } from '../stores/config'
  import type { SafeAppConfig } from '../../../shared/types'

  let { onOpenSettings }: { onOpenSettings?: () => void } = $props()

  let config: SafeAppConfig | null = $state(null)
  let dismissed = $state(false)

  appConfig.subscribe(v => { config = v })

  let banner = $derived.by(() => {
    if (!config || dismissed) return null
    if (config.llmAutoDetected && config.llmProvider) {
      const model = config.llmModel || config.llmProvider
      return {
        variant: 'info' as const,
        text: `AI insights active — analyzing your network with ${model}`,
        action: null,
      }
    }
    if (config.llmEnabled === null && !config.llmProvider) {
      return {
        variant: 'suggest' as const,
        text: 'Get AI-powered root cause analysis and recommendations for network issues',
        action: 'Set up in Settings',
      }
    }
    return null
  })
</script>

{#if banner}
  <div class="llm-banner" class:info={banner.variant === 'info'} class:suggest={banner.variant === 'suggest'}>
    <span class="banner-text">{banner.text}</span>
    <div class="banner-actions">
      {#if banner.action && onOpenSettings}
        <button class="action-btn" onclick={onOpenSettings}>{banner.action}</button>
      {/if}
      <button class="dismiss-btn" onclick={() => dismissed = true}>&times;</button>
    </div>
  </div>
{/if}

<style>
  .llm-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    animation: fadeIn 0.2s ease;
  }
  .info {
    background: #3b82f615;
    border: 1px solid #3b82f630;
    color: #93b4f6;
  }
  .suggest {
    background: #f59e0b10;
    border: 1px solid #f59e0b25;
    color: #f5c778;
  }
  .banner-text {
    flex: 1;
  }
  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .action-btn {
    background: none;
    border: 1px solid currentColor;
    border-radius: 6px;
    color: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    cursor: pointer;
    opacity: 0.85;
    white-space: nowrap;
  }
  .action-btn:hover {
    opacity: 1;
    background: #ffffff08;
  }
  .dismiss-btn {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .dismiss-btn:hover {
    opacity: 1;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
