import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { supabase } from '@/lib/supabase'

// story_inputs is an ordered array indexed by scene order.
// storyInputs[0] = player name (1-Intro)

export function getStoryInputs(userId: string): string[] {
  return lsGet<string[]>(SK.storyInputs(userId), [])
}

export function getStoryInput(userId: string, index: number): string {
  return getStoryInputs(userId)[index] ?? ''
}

export async function setStoryInput(userId: string, index: number, value: string): Promise<void> {
  const inputs = getStoryInputs(userId)
  inputs[index] = value
  lsSet(SK.storyInputs(userId), inputs)

  await supabase.rpc('set_story_input', { p_user_id: userId, p_index: index, p_value: value })
}
