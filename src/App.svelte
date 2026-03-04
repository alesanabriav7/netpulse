<script lang="ts">
  import Dashboard from './lib/components/Dashboard.svelte'
</script>

<Dashboard />

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(body) {
    background: #0f0f14;
    color: #e0e0f0;
    font-family: system-ui, -apple-system, sans-serif;
    color-scheme: dark;
    -webkit-font-smoothing: antialiased;
  }
  :global(button) {
    font-family: inherit;
  }
</style>
