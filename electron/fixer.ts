import type { Fix, FixStatus } from '@shared/types'
import { execProbe } from './probes/exec-probe'

const fixRegistry: Fix[] = [
  {
    id: 'disable-awdl',
    label: 'Disable AWDL',
    description: 'Disables Apple Wireless Direct Link (AirDrop/Handoff) which can cause Wi-Fi interference',
    platforms: ['darwin'],
    command: { darwin: 'sudo ifconfig awdl0 down' },
    reversible: true,
    requiresAdmin: true
  },
  {
    id: 'tcp-tuning',
    label: 'TCP Tuning',
    description: 'Disables delayed ACK (macOS) or sets auto-tuning to normal (Windows) for lower latency',
    platforms: ['darwin', 'win32'],
    command: {
      darwin: 'sudo sysctl -w net.inet.tcp.delayed_ack=0',
      win32: 'netsh int tcp set global autotuninglevel=normal'
    },
    reversible: true,
    requiresAdmin: true
  },
  {
    id: 'dns-cloudflare',
    label: 'Set DNS to Cloudflare',
    description: 'Sets DNS servers to Cloudflare 1.1.1.1 and 1.0.0.1 for faster DNS resolution',
    platforms: ['darwin', 'win32'],
    command: {
      darwin: 'networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1',
      win32: 'netsh interface ip set dns "Wi-Fi" static 1.1.1.1 && netsh interface ip add dns "Wi-Fi" 1.0.0.1 index=2'
    },
    reversible: true,
    requiresAdmin: false
  },
  {
    id: 'flush-dns',
    label: 'Flush DNS Cache',
    description: 'Clears the DNS resolver cache to fix stale or corrupted entries',
    platforms: ['darwin', 'win32'],
    command: {
      darwin: 'sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder',
      win32: 'ipconfig /flushdns'
    },
    reversible: false,
    requiresAdmin: true
  },
  {
    id: 'restart-wifi',
    label: 'Restart Wi-Fi',
    description: 'Cycles the Wi-Fi adapter off and on to reset the connection',
    platforms: ['darwin', 'win32'],
    command: {
      darwin: 'networksetup -setairportpower en0 off && sleep 2 && networksetup -setairportpower en0 on',
      win32: 'netsh interface set interface "Wi-Fi" disable && timeout /t 2 && netsh interface set interface "Wi-Fi" enable'
    },
    reversible: false,
    requiresAdmin: true
  },
  {
    id: 'disable-bluetooth',
    label: 'Disable Bluetooth',
    description: 'Turns off Bluetooth to reduce wireless interference on the 2.4GHz band',
    platforms: ['darwin', 'win32'],
    command: {
      darwin: 'blueutil --power 0',
      win32: 'powershell -Command "Get-PnpDevice -Class Bluetooth | Disable-PnpDevice -Confirm:$false"'
    },
    reversible: true,
    requiresAdmin: true
  },
  {
    id: 'reset-winsock',
    label: 'Reset Winsock',
    description: 'Resets the Windows Sockets catalog to fix network stack corruption',
    platforms: ['win32'],
    command: { win32: 'netsh winsock reset' },
    reversible: false,
    requiresAdmin: true
  },
  {
    id: 'reset-tcpip',
    label: 'Reset TCP/IP Stack',
    description: 'Resets the TCP/IP stack to default settings',
    platforms: ['win32'],
    command: { win32: 'netsh int ip reset' },
    reversible: false,
    requiresAdmin: true
  }
]

const fixStatuses: Map<string, FixStatus> = new Map()

function initFixStatuses(): void {
  for (const fix of fixRegistry) {
    if (!fixStatuses.has(fix.id)) {
      fixStatuses.set(fix.id, { fixId: fix.id, applied: false, lastResult: null })
    }
  }
}
initFixStatuses()

export function getFixRegistry(): Fix[] {
  return fixRegistry.filter((f) => f.platforms.includes(process.platform as 'darwin' | 'win32'))
}

export async function applyFix(fixId: string): Promise<{ success: boolean; message: string }> {
  const fix = fixRegistry.find((f) => f.id === fixId)
  if (!fix) return { success: false, message: `Unknown fix: ${fixId}` }

  const platform = process.platform as 'darwin' | 'win32'
  if (!fix.platforms.includes(platform)) {
    return { success: false, message: `Fix "${fix.label}" is not available on this platform` }
  }

  const rawCmd = fix.command[platform]
  if (!rawCmd) return { success: false, message: `No command defined for ${platform}` }

  let cmd: string
  if (fix.requiresAdmin) {
    if (platform === 'darwin') {
      const escaped = rawCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      cmd = `osascript -e 'do shell script "${escaped}" with administrator privileges'`
    } else {
      const escaped = rawCmd.replace(/'/g, "''")
      cmd = `powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c ${escaped}'"  `
    }
  } else {
    cmd = rawCmd
  }

  const output = await execProbe(cmd, 30_000)
  const success = output !== '' || !fix.requiresAdmin
  const result = { success: true, message: output || 'Fix applied successfully' }

  fixStatuses.set(fixId, { fixId, applied: true, lastResult: result })
  return result
}

export function getFixStatuses(): Record<string, FixStatus> {
  const result: Record<string, FixStatus> = {}
  for (const [id, status] of fixStatuses) {
    result[id] = status
  }
  return result
}
