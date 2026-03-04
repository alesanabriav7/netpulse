import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '@shared/ipc-types'
import { initDb, getLatestMetrics, getMetricsRange, getAnalysis, getSummaries, cleanupOldData } from './db'
import { generateSummary } from './summary'
import { startScheduler, runProbeNow, setSchedulerWindow } from './scheduler'
import { applyFix, getFixStatuses, checkAllFixes } from './fixer'
import { getConfig, setConfig, getSafeConfig } from './config'
import { runDiscoveryAndApply, discoverLlm } from './llm-discovery'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADNSURBVDiNrZMxCsJAEEX/JoUW1noCj+BhPIE38AAewMZOsLATLOy0sxRRMJkZi2RDstlV/DDswPC/zOxsAPwrJJ0kfUh6SmokfXKU9JC0I3kg6fJJBhCBHXBN+w1QxeLfCmBBclMC3IEbcAB2wI3kigYAKJLcTIBXoClRkpL2Uf4C5N2YFDFAmiaJOvViyv9FHZKG83kQTdMUGGthr4W9SWB8dx7Fw6FP8lg9ysHB3Xn9YOMgM/hf09YGOJ7Pa/uxDsysBWAsALPfyAeAAi7XWGslAAAAAElFTkSuQmCC'
  )
  if (process.platform === 'darwin') icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('NetPulse')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Run Test Now',
      click: () => {
        runProbeNow()
      }
    },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          mainWindow = createWindow()
          setSchedulerWindow(mainWindow)
          setupWindowClose()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function setupWindowClose(): void {
  if (!mainWindow) return
  mainWindow.on('close', (e) => {
    if (isQuitting) return
    const config = getConfig()
    if (config.minimizeToTray && tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(async () => {
  initDb()
  cleanupOldData()

  await runDiscoveryAndApply()

  mainWindow = createWindow()

  // Broadcast config after discovery so renderer picks up auto-detected LLM
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.CONFIG_UPDATED, getSafeConfig())
    }
  })

  startScheduler(mainWindow)
  createTray()
  setupWindowClose()

  // IPC Handlers
  ipcMain.handle(IPC_CHANNELS.GET_LATEST_METRICS, () => getLatestMetrics())
  ipcMain.handle(IPC_CHANNELS.GET_METRICS_RANGE, (_e, from: string, to: string) => getMetricsRange(from, to))
  ipcMain.handle(IPC_CHANNELS.RUN_PROBE_NOW, () => {
    return runProbeNow()
  })
  ipcMain.handle(IPC_CHANNELS.APPLY_FIX, (_e, fixId: string) => applyFix(fixId))
  ipcMain.handle(IPC_CHANNELS.GET_ANALYSIS, () => getAnalysis())
  ipcMain.handle(IPC_CHANNELS.GET_FIX_STATUSES, () => getFixStatuses())
  ipcMain.handle(IPC_CHANNELS.CHECK_FIXES, () => checkAllFixes())
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => getSafeConfig())
  ipcMain.handle(IPC_CHANNELS.SET_CONFIG, (_e, partial) => {
    setConfig(partial)
    const safe = getSafeConfig()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.CONFIG_UPDATED, safe)
    }
    return safe
  })
  ipcMain.handle(IPC_CHANNELS.LLM_DISCOVER, async () => {
    const result = await discoverLlm()
    return { provider: result.provider, source: result.source }
  })
  ipcMain.handle(IPC_CHANNELS.GET_SUMMARIES, () => getSummaries())
  ipcMain.handle(IPC_CHANNELS.GENERATE_SUMMARY, async () => {
    const summary = await generateSummary()
    if (summary && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SUMMARY_UPDATED, getSummaries())
    }
    return summary
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      setSchedulerWindow(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  const config = getConfig()
  if (process.platform !== 'darwin' && !config.minimizeToTray) {
    app.quit()
  }
})
