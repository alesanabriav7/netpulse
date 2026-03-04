import { Notification } from 'electron'
import type { OverallStatus } from '@shared/types'

let lastNotificationTime = 0
const THROTTLE_MS = 30 * 60 * 1000 // 30 minutes

export function notifyDegradation(status: OverallStatus, summary: string): void {
  if (status === 'healthy' || status === 'unknown') return

  const now = Date.now()
  if (now - lastNotificationTime < THROTTLE_MS) return
  lastNotificationTime = now

  const notification = new Notification({
    title: `NetPulse: Network ${status === 'critical' ? 'Critical' : 'Degraded'}`,
    body: summary
  })
  notification.show()
}
