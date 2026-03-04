import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-types'
import type { IpcApi } from '@shared/ipc-types'

const api: IpcApi = {
  getLatestMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LATEST_METRICS),
  getMetricsRange: (from, to) => ipcRenderer.invoke(IPC_CHANNELS.GET_METRICS_RANGE, from, to),
  runProbeNow: () => ipcRenderer.invoke(IPC_CHANNELS.RUN_PROBE_NOW),
  applyFix: (fixId) => ipcRenderer.invoke(IPC_CHANNELS.APPLY_FIX, fixId),
  getAnalysis: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ANALYSIS),
  getFixStatuses: () => ipcRenderer.invoke(IPC_CHANNELS.GET_FIX_STATUSES),
  checkFixes: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FIXES),
  onMetricsUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, metrics: unknown) => callback(metrics as Parameters<typeof callback>[0])
    ipcRenderer.on(IPC_CHANNELS.METRICS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.METRICS_UPDATED, handler)
  },
  onAnalysisUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, analysis: unknown) => callback(analysis as Parameters<typeof callback>[0])
    ipcRenderer.on(IPC_CHANNELS.ANALYSIS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ANALYSIS_UPDATED, handler)
  },
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  setConfig: (partial) => ipcRenderer.invoke(IPC_CHANNELS.SET_CONFIG, partial),
  onConfigUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, config: unknown) => callback(config as Parameters<typeof callback>[0])
    ipcRenderer.on(IPC_CHANNELS.CONFIG_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_UPDATED, handler)
  },
  onProbeProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, step: unknown) => callback(step as Parameters<typeof callback>[0])
    ipcRenderer.on(IPC_CHANNELS.PROBE_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROBE_PROGRESS, handler)
  },
  getSummaries: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SUMMARIES),
  generateSummary: () => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_SUMMARY),
}

contextBridge.exposeInMainWorld('api', api)
