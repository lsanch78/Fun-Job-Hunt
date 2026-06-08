# fjobhunt — Domain Glossary

## Job
A tracked job opportunity. Exists from first save through final resolution. Always has a **Status**.

Not split into "saved" vs "applied" — Wishlist is simply the earliest Status.

### Job Status
The current stage of a Job in the user's pipeline.
Ordered progression: `Wishlist → Applied → Phone Screen → Interview → Offer → Rejected | Ghosted`

Rejected and Ghosted are terminal statuses. A Job can move backwards (e.g. re-applying after rejection) by creating a new Job record.

---

## Workday
A single tracked work session for a given calendar day. Defined by a punch-in timestamp and a punch-out timestamp.

Total hours = (punch-out time − punch-in time) − derived break time.

### Punch-In
The action that starts a Workday. Records the current wall-clock timestamp. Also satisfies the daily requirement for a Streak increment.

### Punch-Out
The action that ends a Workday. Records the wall-clock timestamp of the user's **last activity**, not the moment the timer fires.

Auto punch-out fires after **1 hour of frontend inactivity** (no clicks, navigation, or form input). Punch-out is recorded at last-activity time.

### Shift Length
A user-configurable target duration for a Workday. Defaults to 8 hours. Drives break expectations and the HUD countdown display.

### Derived Breaks
Break time calculated from Shift Length. Not manually logged. Used to compute expected net hours.

| Shift Length | Breaks |
|---|---|
| < 4 hrs | None |
| 4–6 hrs | 1 × 15 min |
| 6–8 hrs | 2 × 15 min + 30 min lunch |
| 8+ hrs | 2 × 15 min + 60 min lunch |

---

## Streak
A count of consecutive calendar days on which the user punched in. Increments once per calendar day on first punch-in.

### Grace Day (Streak Freeze)
One automatic freeze per week. Burns automatically when the user misses a day and has a freeze available. No manual action required.

---

## XP (Experience Points)
A numeric score earned by completing in-app actions. Drives Rank progression. All values are defined in a single tunable config constant.

### XP Events (v1)
| Event | XP |
|---|---|
| First punch-in of the day | 10 |
| Adding a Job | 20 |
| Job status upgrade | 50 |
| Unlocking an Achievement | 100 |
| 7-day streak milestone | 200 |
| First Offer | 500 |

---

## Rank
A title awarded based on cumulative XP. Eleven ranks total. Thresholds defined in config alongside XP values.

**Employed** (rank 11) is triggered by a manual toggle in Settings, not by reaching an XP threshold.

### Rank Titles
| Rank | Title |
|---|---|
| 1 | Destitute Job Seeker |
| 2 | Soulless Interview Preparer |
| 3 | LinkedIn Serf |
| 4 | Forgotten Follow Upper |
| 5 | First Round Peasant |
| 6 | Resume Goblin |
| 7 | Second Round Warden |
| 8 | Interview Ghost |
| 9 | Third Round Lord |
| 10 | Final King |
| 11 | Employed |

---

## Achievement
A one-time milestone badge earned by reaching a specific threshold or completing a specific action. Unlocking an Achievement awards XP.

---

## Theme
A named color palette applied globally to the UI. Four options: Classic Terminal, NES RPG, Game Boy, Arcade Cabinet. Switchable live from Settings.

---

## Music Player
A persistent bottom-bar HUD element. Plays YouTube videos/playlists via the YouTube IFrame API. Desktop-only for v1. Users can paste YouTube links and save playlists. Default playlists are provided (lofi 8-bit, chiptune study, retro game OSTs).

---

## Job Cap
The maximum number of Jobs a user may have active at one time: **1,000**. Enforced at two layers — UI (before draft creation) and service (count query before insert). When the cap is reached, the user is prompted to export their data and delete old terminal-status Jobs before adding new ones.

---

## Field Limits
Character limits enforced at three layers: frontend `maxLength`, service-layer validation before DB writes, and DB `varchar(N)` constraints as a final backstop. The canonical source of truth is a single `JOB_LIMITS` constants object in `jobService.ts`.

| Field | Limit |
|---|---|
| company | 100 |
| title | 150 |
| posting_url | 500 |
| salary | 20 |
| description | 5,000 |
| contacts | 1,000 |
| notes | 2,000 |
| cover_letter_prompt | 3,000 |
| why_good_fit_prompt | 3,000 |
| jdText (AI panel, not persisted) | 10,000 — frontend only |

---

## Quick Cast Links
Hotbar shortcuts per user. Maximum **20 links** per user. Enforced in the UI.

---

## Music Tracks
Saved YouTube tracks per user. Maximum **50 tracks** per user. Enforced in the UI.
