import type { ThroughputResult } from '@shared/types'

export async function runThroughput(): Promise<ThroughputResult> {
  if (process.platform === 'darwin') {
    const { runThroughputMac } = await import('./mac')
    return runThroughputMac()
  } else {
    const { runThroughputWindows } = await import('./windows')
    return runThroughputWindows()
  }
}
