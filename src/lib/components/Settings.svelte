<script lang="ts">
  import { appConfig, saveConfig, loadConfig } from '../stores/config'
  import type { AppConfig } from '../../../shared/types'

  let { open = $bindable(false) }: { open: boolean } = $props()

  let config: AppConfig | null = $state(null)
  let saving = $state(false)

  appConfig.subscribe(v => { config = v ? { ...v } : null })

  const providerDefaults: Record<string, { baseUrl: string; model: string }> = {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
    ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  }

  function onProviderChange(provider: string) {
    if (!config) return
    const p = provider || null
    config.llmProvider = p as AppConfig['llmProvider']
    if (p && providerDefaults[p]) {
      config.llmBaseUrl = providerDefaults[p].baseUrl
      config.llmModel = providerDefaults[p].model
      if (p === 'ollama') config.llmApiKey = null
    } else {
      config.llmBaseUrl = null
      config.llmModel = null
      config.llmApiKey = null
    }
  }

  async function handleSave() {
    if (!config) return
    saving = true
    try {
      await saveConfig(config)
      open = false
    } finally {
      saving = false
    }
  }

  function handleClose() {
    open = false
    loadConfig() // reset to saved values
  }
</script>

{#if open && config}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="overlay" role="presentation" onclick={handleClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_interactive_supports_focus -->
    <div class="modal" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <header>
        <h2>Settings</h2>
        <button class="close-btn" onclick={handleClose}>&times;</button>
      </header>

      <div class="section">
        <h3>Monitoring</h3>
        <label>
          <span>Probe interval</span>
          <select bind:value={config.probeIntervalMinutes}>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
        </label>
        <label class="toggle-row">
          <span>Minimize to tray</span>
          <input type="checkbox" bind:checked={config.minimizeToTray} />
        </label>
      </div>

      <div class="section">
        <h3>AI Analysis</h3>
        <label>
          <span>Provider</span>
          <select
            value={config.llmProvider || ''}
            onchange={(e) => onProviderChange((e.target as HTMLSelectElement).value)}
          >
            <option value="">None</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </label>

        {#if config.llmProvider}
          {#if config.llmProvider !== 'ollama'}
            <label>
              <span>API Key</span>
              <input type="password" bind:value={config.llmApiKey} placeholder="sk-..." />
            </label>
          {/if}
          <label>
            <span>Base URL</span>
            <input type="text" bind:value={config.llmBaseUrl} />
          </label>
          <label>
            <span>Model</span>
            <input type="text" bind:value={config.llmModel} />
          </label>
        {/if}
      </div>

      <footer>
        <button class="cancel-btn" onclick={handleClose}>Cancel</button>
        <button class="save-btn" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 16px;
    width: 460px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 24px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  h2 {
    color: #e0e0f0;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  .close-btn {
    background: none;
    border: none;
    color: #6b6b80;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .close-btn:hover { color: #e0e0f0; }
  .section {
    margin-bottom: 20px;
  }
  h3 {
    color: #8b8ba0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 12px 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }
  label span {
    color: #a0a0b0;
    font-size: 13px;
    font-weight: 500;
  }
  .toggle-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .toggle-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #3b82f6;
  }
  select, input[type="text"], input[type="password"] {
    background: #0f0f14;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #e0e0f0;
    font-size: 14px;
    padding: 8px 12px;
    outline: none;
  }
  select:focus, input:focus {
    border-color: #3b82f6;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #2a2a3a;
  }
  .cancel-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #2a2a3a;
    background: transparent;
    color: #a0a0b0;
    font-size: 14px;
    cursor: pointer;
  }
  .cancel-btn:hover { background: #2a2a3a; }
  .save-btn {
    padding: 8px 20px;
    border-radius: 8px;
    border: none;
    background: #3b82f6;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .save-btn:hover { background: #2563eb; }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
