# fjobhunt — Product Specification

## Overview

A gamified, 8-bit themed job search web app. Replaces spreadsheet tracking with a game HUD interface, workday time tracking, achievements, streaks, and an 8-bit YouTube music player. Public-facing, individually authenticated.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend / DB | Supabase (auth + database) |
| Font | Press Start 2P (Google Fonts) |
| Hosting | Vercel |

---

## Authentication

- Email/password signup and login via Supabase Auth
- SSO (Google, Apple) — stubbed, coming later
- User profile: username, pixel art avatar selection, theme preference, employed status (manual trigger)

---

## Database Tables

| Table | Columns | Status |
|---|---|---|
| `jobs` | id (client-generated uuid), user_id, company, title, status, posting_url, date_applied (text YYYY-MM-DD), interview_stage, rating, salary | **Live** |
| `profiles` | id, username, avatar, theme, xp, rank, employed, created_at | Planned |
| `workdays` | id (server-generated uuid), user_id, punch_in (timestamptz), punch_out (timestamptz nullable), date (text YYYY-MM-DD) | **Live** |
| `achievements` | id, user_id, type, earned_at | Planned |
| `streaks` | id, user_id, current_streak, longest_streak, last_active, grace_days_used_this_week | Planned |

**Jobs status enum (DB):** `APPLIED` · `PHONE_SCREEN` · `INTERVIEW` · `OFFER` · `REJECTED` · `GHOSTED` · `WITHDRAWN`

**Jobs interview_stage enum (DB):** `PHONE` · `TECHNICAL` · `ONSITE` · `FINAL` · `OFFER` (nullable)

**Jobs data layer:** Fat client — `localStorage` cache keyed `fjobhunt:jobs:{userId}`. On mount: render from cache immediately, hydrate from DB in background. Writes go to cache first, then Supabase fire-and-forget. XP and rank are computed client-side from committed job count; not persisted yet.

**Workdays data layer:** Write-through on punch-in/out — no cache. `localStorage` holds `workday_punch_in` (ISO string) and `workday_id` (active row UUID) for session recovery. Punch-out timestamp uses last-activity time per ADR 0001.

---

## Pages & Views

### 1. Auth Screen (`/auth`)

- Title screen with blinking "PRESS ENTER TO START"
- Returning users see "WELCOME BACK, [NAME]" + "PRESS ENTER TO CONTINUE"
- Login / Signup toggle with email + password
- SSO buttons (disabled, coming soon)
- Scanline overlay, 8-bit styled

### 2. Job Log (`/jobs`) — Landing page

- Inline editable table of all job applications
- Press Enter to commit a row; Tab navigates between uncommitted rows
- Columns: Company, Title, URL, Salary, Rating (1–5 stars), Date, Status + Interview Stage
- Commit indicator: blinking `↵` → pixel spinner (orbiting `▪`) while DB insert is in-flight → `✓` once confirmed
- XP tracker in header: rank, title, XP bar — updates on each commit
- Status options: `APPLIED` · `PHONE_SCREEN` · `INTERVIEW` · `OFFER` · `REJECTED` · `GHOSTED` · `WITHDRAWN`
- `PHONE_SCREEN` / `INTERVIEW` statuses reveal an interview stage sub-select
- Edits to committed rows debounce 500ms then sync to DB
- `/` redirects here

### 3. Stats (`/stats`)

- Stat cards: streak · hours this week · hours total (stubbed, computed later)
- Workday log table: date · punch-in time · punch-out time (ACTIVE blinking if session open)
- Fetches all workday rows from DB on mount

### 4. Settings (`/settings`)

- Theme switcher — live preview of all 4 palettes
- Profile edit (username, avatar)
- Shift length slider (default 8hrs)
- Playlist manager (paste YouTube links, set as default)
- Employed toggle (triggers rank 11)

---

## Music Player

- Persistent bottom bar HUD element
- Play/pause, skip, volume
- User pastes YouTube video/playlist links
- Default playlists: lofi 8-bit, chiptune study, retro game OSTs
- Rendered via YouTube IFrame API
- Desktop-only (v1)

---

## Gamification

### XP Events

All values defined in `src/config/game.ts` — tunable without touching components.

| Event | XP |
|---|---|
| First punch-in of the day | 10 |
| Adding a job | 20 |
| Job status upgrade | 50 |
| Unlocking an achievement | 100 |
| 7-day streak milestone | 200 |
| First offer | 500 |

### Ranks

XP thresholds defined in `src/config/game.ts`.

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
| 11 | Employed ← manual toggle only, not XP-gated |

### Streaks

- Increments on first punch-in of each calendar day
- 1 grace day (auto-burn) per week on a missed day
- Displayed in WorkdayBar (bottom HUD)

### Workday Rules

- Punch-out recorded at **last-activity time**, not timer-fire time
- Auto punch-out fires after **1 hour of frontend inactivity**
- Shift length configurable (default 8hrs); breaks derived automatically:

| Shift | Breaks |
|---|---|
| < 4 hrs | None |
| 4–6 hrs | 1 × 15 min |
| 6–8 hrs | 2 × 15 min + 30 min lunch |
| 8+ hrs | 2 × 15 min + 60 min lunch |

---

## Achievements (examples)

| Badge | Trigger |
|---|---|
| First Quest | Submit first application |
| Sending It | 10 applications |
| Grind Season | 50 applications |
| Clocked In | First full workday logged |
| On a Roll | 7-day streak |
| They Called Back | First phone screen |
| Final Boss | First offer |

---

## Themes

| Name | Colors |
|---|---|
| Classic Terminal | Black + phosphor green + amber |
| NES RPG | Dark navy + cyan + magenta + yellow |
| Game Boy | 4-shade olive green monochrome |
| Arcade Cabinet | Black + hot pink + electric blue |

All themes implemented via CSS custom properties on `data-theme` attribute. Switched live from Settings. Persisted to `localStorage`.

---

## Design Constraints

- Desktop-first (v1) — no mobile support
- Font: Press Start 2P everywhere
- Scanline overlay on auth screen
- Pixel-perfect aesthetic throughout — no rounded corners, no shadows, no gradients
