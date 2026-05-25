// Simple callback bus — avoids prop drilling through route layout
let _trigger: (() => void) | null = null
export function registerTutorialTrigger(fn: () => void) { _trigger = fn }
export function unregisterTutorialTrigger() { _trigger = null }
export function fireTutorial() { _trigger?.() }
