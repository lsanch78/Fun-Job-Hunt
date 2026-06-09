// Simple callback bus — avoids prop drilling through route layout
let _trigger: (() => void) | null = null
export function registerTutorialTrigger(fn: () => void) { _trigger = fn }
export function unregisterTutorialTrigger() { _trigger = null }
export function fireTutorial() { _trigger?.() }
export function hasTutorialTrigger() { return _trigger !== null }

// Active-state broadcast so NavBar can light up the button
let _activeListener: ((active: boolean) => void) | null = null
export function registerTutorialActiveListener(fn: (active: boolean) => void) { _activeListener = fn }
export function unregisterTutorialActiveListener() { _activeListener = null }
export function broadcastTutorialActive(active: boolean) { _activeListener?.(active) }

