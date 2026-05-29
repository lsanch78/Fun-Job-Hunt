// Single source of truth for every localStorage key used in the app.
// Import SK from here — never hard-code key strings anywhere else.
export const SK = {
  // ── Workday ──────────────────────────────────────────────────────────────────
  workdayPunchIn: 'workday_punch_in',
  workdayId:      'workday_id',

  // ── Jobs / XP ────────────────────────────────────────────────────────────────
  jobs:      (uid: string) => `fjobhunt:jobs:${uid}`,
  workdays:  (uid: string) => `fjobhunt:workdays:${uid}`,
  xp:        (uid: string) => `fjobhunt:xp:${uid}`,
  autoGhost: 'fjobhunt:autoghost',

  // ── Scratch pad ──────────────────────────────────────────────────────────────
  scratchPad:    (uid: string) => `fjobhunt:scratchpad:${uid}`,
  scratchList:   (uid: string) => `fjobhunt:scratchlist:${uid}`,
  scratchTab:    'fjobhunt:scratchtab',
  scratchHeight: 'fjobhunt:scratchheight',
  scratchOpen:   'fjobhunt:scratchopen',

  // ── Quick cast ───────────────────────────────────────────────────────────────
  quickcastLinks: (uid: string) => `fjobhunt:quickcast:links:${uid}`,

  // ── AI ───────────────────────────────────────────────────────────────────────
  aiProvider:   'fjobhunt:ai:provider',
  aiApiKey:     'fjobhunt:ai:apikey',
  aiPanelSlots: (uid: string) => `fjobhunt:ai-panel-slots:${uid}`,
  aiPanelText:  (uid: string) => `fjobhunt:ai-panel-text:${uid}`,

  // ── Theme ─────────────────────────────────────────────────────────────────────
  theme:        'fjobhunt:theme',
  customColors: 'fjobhunt:custom-colors',

  // ── Global stats ──────────────────────────────────────────────────────────────
  globalStats: 'fjobhunt:global_stats',

  // ── SFX ───────────────────────────────────────────────────────────────────────
  sfxMuted: 'fjobhunt:sfx:muted',

  // ── Comm ──────────────────────────────────────────────────────────────────────
  commCooldown: (uid: string) => `fjobhunt:${uid}:comm-cooldown-hours`,

  // ── Tutorial ──────────────────────────────────────────────────────────────────
  tutorialSeen: (uid: string) => `fjobhunt:tutorial_seen:${uid}`,

  // ── Music ─────────────────────────────────────────────────────────────────────
  musicTracks:  'fjobhunt:music:tracks',
  musicVolume:  'fjobhunt:music:volume',
  musicResume:  'fjobhunt:music:resume',
  musicShuffle: 'fjobhunt:music:shuffle',
} as const
