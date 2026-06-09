// Single source of truth for every localStorage key used in the app.
// Import SK from here — never hard-code key strings anywhere else.

export type { AiMode } from '@/types'

export const SK = {
  // ── Activity timer ────────────────────────────────────────────────────────────
  activityHeartbeats: (uid: string) => `fjobhunt:activity-heartbeats:${uid}`,

  // ── Jobs & progress ──────────────────────────────────────────────────────────
  jobs:      (uid: string) => `fjobhunt:jobs:${uid}`,
  xp:        (uid: string) => `fjobhunt:xp:${uid}`,
  autoGhost: 'fjobhunt:autoghost',

  // ── Journal ───────────────────────────────────────────────────────────────────
  journal:       (uid: string) => `fjobhunt:journal:${uid}`,
  journalList:   (uid: string) => `fjobhunt:journallist:${uid}`,
  journalTab:    'fjobhunt:journaltab',
  journalHeight: 'fjobhunt:journalheight',
  journalOpen:   'fjobhunt:journalopen',

  // ── Contacts & comms ─────────────────────────────────────────────────────────
  quickcastLinks: (uid: string) => `fjobhunt:quickcast:links:${uid}`,
  commCooldown:   (uid: string) => `fjobhunt:comm-cooldown:${uid}`,
  outreachPrompt: 'fjobhunt:outreach_custom_prompt',

  // ── AI assistant ─────────────────────────────────────────────────────────────
  aiMode:       (uid: string) => `fjobhunt:ai:mode:${uid}`,
  aiProvider:   'fjobhunt:ai:provider',
  aiApiKey:     'fjobhunt:ai:apikey',
  aiModalSlots: (uid: string) => `fjobhunt:ai-modal-slots:${uid}`,
  aiModalText:  (uid: string) => `fjobhunt:ai-modal-text:${uid}`,
  // ── Theme & display ──────────────────────────────────────────────────────────
  theme:        'fjobhunt:theme',
  customColors: 'fjobhunt:custom-colors',

  // ── Audio ────────────────────────────────────────────────────────────────────
  sfxMuted:     'fjobhunt:sfx:muted',
  musicTracks:  'fjobhunt:music:tracks',
  musicVolume:  'fjobhunt:music:volume',
  musicResume:  'fjobhunt:music:resume',
  musicShuffle: 'fjobhunt:music:shuffle',

  // ── UI state ─────────────────────────────────────────────────────────────────
  authSound:      'fjobhunt:auth_sound',
  colConfig:      'fjobhunt:col_config',
  timeRange:      'fjobhunt:time_range',
  networkTimeRange: 'fjobhunt:network_time_range',
  tutorialSeen:   (uid: string, screen: string) => `fjobhunt:tutorial_seen:${screen}:${uid}`,
  cvNudgeDismissed: (uid: string) => `fjobhunt:cv_nudge_dismissed:${uid}`,
  globalStats:    'fjobhunt:global_stats',
} as const
