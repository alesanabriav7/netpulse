import { writable } from 'svelte/store'
import type { Analysis } from '../../../shared/types'

export const insights = writable<Analysis[]>([])

export async function loadAnalysis(): Promise<void> {
  insights.set(await window.api.getAnalysis())
}

export function initAnalysisStore(): () => void {
  loadAnalysis()
  return window.api.onAnalysisUpdate((data) => {
    insights.set(data)
  })
}
