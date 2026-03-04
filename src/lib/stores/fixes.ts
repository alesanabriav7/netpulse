import { writable } from 'svelte/store'
import type { FixStatus } from '../../../shared/types'

export const fixStatuses = writable<Record<string, FixStatus>>({})

export async function loadFixStatuses(): Promise<void> {
  fixStatuses.set(await window.api.getFixStatuses())
}

export async function checkFixes(): Promise<void> {
  fixStatuses.set(await window.api.checkFixes())
}

export async function applyFix(fixId: string): Promise<{ success: boolean; message: string }> {
  const result = await window.api.applyFix(fixId)
  fixStatuses.update((statuses) => ({
    ...statuses,
    [fixId]: { fixId, applied: result.success, lastResult: result },
  }))
  return result
}
