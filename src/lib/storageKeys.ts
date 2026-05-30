// Single source of truth for every localStorage key used in the app.
// Import SK from here — never hard-code key strings anywhere else.
export const SK = {
  // ── Workday tracking ─────────────────────────────────────────────────────────
  workdayPunchIn: 'fjobhunt:workday:punch-in',
  workdayId:      'fjobhunt:workday:id',

  // ── Jobs & progress ──────────────────────────────────────────────────────────
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

  // ── Contacts & comms ─────────────────────────────────────────────────────────
  quickcastLinks: (uid: string) => `fjobhunt:quickcast:links:${uid}`,
  commCooldown:   (uid: string) => `fjobhunt:comm-cooldown:${uid}`,
  outreachPrompt: 'fjobhunt:outreach_custom_prompt',

  // ── AI assistant ─────────────────────────────────────────────────────────────
  aiProvider:   'fjobhunt:ai:provider',
  aiApiKey:     'fjobhunt:ai:apikey',
  aiPanelSlots: (uid: string) => `fjobhunt:ai-panel-slots:${uid}`,
  aiPanelText:  (uid: string) => `fjobhunt:ai-panel-text:${uid}`,

  // ── Theme & display ──────────────────────────────────────────────────────────
  theme:        'fjobhunt:theme',
  customColors: 'fjobhunt:custom-colors',

  // ── Audio ────────────────────────────────────────────────────────────────────
  sfxMuted:     'fjobhunt:sfx:muted',
  musicTracks:  'fjobhunt:music:tracks',
  musicVolume:  'fjobhunt:music:volume',
  musicResume:  'fjobhunt:music:resume',
  musicShuffle: 'fjobhunt:music:shuffle',

  // ── Story inputs ─────────────────────────────────────────────────────────────
  storyInputs:    (uid: string) => `fjobhunt:story-inputs:${uid}`,

  // ── UI state ─────────────────────────────────────────────────────────────────
  authSound:      'fjobhunt:auth_sound',
  colConfig:      'fjobhunt:col_config',
  timeRange:      'fjobhunt:time_range',
  networkTimeRange: 'fjobhunt:network_time_range',
  tutorialSeen:   (uid: string) => `fjobhunt:tutorial_seen:${uid}`,
  globalStats:    'fjobhunt:global_stats',
} as const
