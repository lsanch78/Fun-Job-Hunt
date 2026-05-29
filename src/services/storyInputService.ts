import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

// Story inputs are stored as an ordered array indexed by position.
// Access a specific input by its numeric key (matches the scene order it was collected).
// Example: storyInputs[0] = player name from 00-SelfDoubt

export function getStoryInputs(userId: string): string[] {
  return lsGet<string[]>(SK.storyInputs(userId), [])
}

export function setStoryInput(userId: string, index: number, value: string): void {
  const inputs = getStoryInputs(userId)
  inputs[index] = value
  lsSet(SK.storyInputs(userId), inputs)
}

export function getStoryInput(userId: string, index: number): string {
  return getStoryInputs(userId)[index] ?? ''
}
