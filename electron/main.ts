import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '@shared/ipc-types'
import { initDb, getLatestMetrics, getMetricsRange, getAnalysis, cleanupOldData } from './db'
import { startScheduler, runProbeNow } from './scheduler'
import { applyFix, getFixStatuses } from './fixer'

let mainWindow: BrowserWindow | null = null

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

app.whenReady().then(() => {
  initDb()
  cleanupOldData()

  mainWindow = createWindow()
  startScheduler(mainWindow)

  // IPC Handlers
  ipcMain.handle(IPC_CHANNELS.GET_LATEST_METRICS, () => getLatestMetrics())
  ipcMain.handle(IPC_CHANNELS.GET_METRICS_RANGE, (_e, from: string, to: string) => getMetricsRange(from, to))
  ipcMain.handle(IPC_CHANNELS.RUN_PROBE_NOW, () => {
    if (mainWindow) return runProbeNow(mainWindow)
  })
  ipcMain.handle(IPC_CHANNELS.APPLY_FIX, (_e, fixId: string) => applyFix(fixId))
  ipcMain.handle(IPC_CHANNELS.GET_ANALYSIS, () => getAnalysis())
  ipcMain.handle(IPC_CHANNELS.GET_FIX_STATUSES, () => getFixStatuses())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      startScheduler(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
