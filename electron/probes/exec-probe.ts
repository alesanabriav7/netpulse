import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function execProbe(cmd: string, timeout = 30_000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout })
    return stdout.trim()
  } catch {
    return ''
  }
}
