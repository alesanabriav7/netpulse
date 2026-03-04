<script lang="ts">
  import { appConfig } from '../stores/config'
  import type { SafeAppConfig } from '../../../shared/types'

  let config: SafeAppConfig | null = $state(null)
  let dismissed = $state(false)

  appConfig.subscribe(v => { config = v })

  let message = $derived.by(() => {
    if (!config || dismissed) return null
    if (config.llmAutoDetected && config.llmProvider) {
      const model = config.llmModel || config.llmProvider
      return `AI analysis enabled via ${config.llmProvider} (${model})`
    }
    if (config.llmEnabled === null && !config.llmProvider) {
      return 'Enable AI analysis in Settings for network insights'
    }
    return null
  })

  let variant = $derived<'info' | 'suggest'>(config?.llmAutoDetected && config?.llmProvider ? 'info' : 'suggest')
</script>

{#if message}
  <div class="llm-banner" class:info={variant === 'info'} class:suggest={variant === 'suggest'}>
    <span class="banner-text">{message}</span>
    <button class="dismiss-btn" onclick={() => dismissed = true}>&times;</button>
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
  .dismiss-btn {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    font-size: 18px;
    cursor: pointer;
    padding: 0 0 0 12px;
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
