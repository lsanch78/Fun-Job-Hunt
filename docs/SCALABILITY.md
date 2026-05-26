# Scalability Plan

fjobhunt is a free app. This document records the decisions made to protect against runaway storage and DB costs, the worst-case exposure per user, and what has been deferred and why.

## Implementation Status

| Protection | Status | Where |
|---|---|---|
| Field char limits — frontend `maxLength` | **Implemented** | `JobLogPage.tsx`, `AppDetailCard.tsx`, `SettingsPage.tsx`, `AiPanel.tsx` |
| Field char limits — service validation | **Implemented** | `jobService.ts` (`JOB_LIMITS`), `aiSettingsService.ts` (`AI_PROMPT_LIMIT`) |
| Field char limits — DB varchar constraints | **Implemented** | `supabase/migrations/20250526000000_field_length_constraints.sql` |
| Scratch pad char limits (8,000 each) | **Implemented** | `scratchPadService.ts`, `supabase/migrations/20250526000001_scratch_pad.sql` |
| PDF size limit — frontend (1 MB) | **Implemented** | `resumeService.ts` `uploadResumePdf` |
| PDF size limit — Supabase bucket policy (1 MB) | **Implemented** | Supabase dashboard — `resumes` bucket |
| Job cap (1,000) — UI + service | **Implemented** | `JobLogPage.tsx` `handleCommit` + `jobService.ts` `insertJob` `countJobs` |
| Quick cast row cap (8) — UI | **Implemented** | `QuickCast.tsx` `MAX_SLOTS = 8` (already enforced, tighter than plan) |
| Music track row cap (50) — UI | **Implemented** | `MusicPlayer.tsx` `MAX_TRACKS = 50` |
| Abandoned user purge | Deferred | Revisit at 500+ users |
| All-time hours materialization | Deferred | Revisit when users report slow Stats page |

---

## Threat Model

The app runs on Supabase free tier:
- **DB:** 500 MB
- **File storage:** 1 GB
- **Bandwidth:** 5 GB/month

Without limits, a single user can cause outsized damage:
- Paste 50,000 chars into every text field across 1,000 job rows
- Upload three 20 MB scanned PDFs
- Never return, leaving dead storage forever

At 1,000 users doing any of the above, the free tier collapses.

---

## Per-User Storage Budget (With Limits Enforced)

| Source | Max per user |
|---|---|
| Job rows (1,000 jobs × ~9 KB each at field limits) | ~9 MB |
| Resume PDFs (3 slots × 1 MB) | 3 MB |
| AI settings (2 prompts × 3,000 chars) | ~6 KB |
| Workday rows (unlimited, but ~100 bytes each) | ~200 KB at 2,000 rows |
| Quick cast links (20 × ~600 chars) | ~12 KB |
| Music tracks (50 × ~600 chars) | ~30 KB |
| Scratch pad (notes 8,000 + list 8,000 chars) | ~16 KB |
| **Total worst case** | **~12 MB** |

At 1,000 users worst-case: ~12 GB DB + storage combined. This exceeds free tier and is the signal to move to a paid plan or implement abandoned-user purging.

---

## Enforced Limits

### Field Character Limits

Enforced at three layers: frontend `maxLength`, service-layer validation before DB writes, and DB `varchar(N)` constraints as a backstop. The canonical numbers live in a single `JOB_LIMITS` constants object in `src/services/jobService.ts`.

| Field | Limit | Rationale |
|---|---|---|
| company | 100 chars | Longest real company names ~60 chars |
| title | 150 chars | Verbose job titles rarely exceed 80 |
| posting_url | 500 chars | URLs over 500 chars are edge cases |
| salary | 20 chars | "$999,999/yr" is 11 chars |
| description | 5,000 chars | ~750 words, covers verbose JDs |
| contacts | 1,000 chars | A few names/emails |
| notes | 2,000 chars | Half a page of notes |
| cover_letter_prompt | 3,000 chars | Generous system prompt |
| why_good_fit_prompt | 3,000 chars | Same |
| resume slot name | 50 chars | "My Senior Dev Resume" |
| jdText (AI panel) | 10,000 chars | Frontend only — never persisted to DB |

### Validation Error Handling

Service layer returns `{ error: string | null }` for all write functions (including `updateJob`, which was changed from `void`). Validation errors surface in the UI via the existing XP popup system (red popup, same dismissal timing). Detail card save errors use the existing `saveState: 'error'` branch.

### Job Cap

**1,000 jobs per user.** Enforced at two layers:

1. **UI** — count check before a new draft row is created. If at cap, a prompt is shown explaining the limit and offering two escape valves: delete old terminal-status jobs (Rejected, Ghosted, Withdrawn), or export data and reset.
2. **Service** — live `count(*)` query in `insertJob` before the DB write. Uses a live query (not cache) so deletes are reflected immediately.

See [CONTEXT.md](../CONTEXT.md) — Job Cap.

### Resume PDF Size

**1 MB per file.** Enforced at two layers:

1. **Frontend** — size check in `src/services/resumeService.ts` before the upload call.
2. **Supabase Storage bucket policy** — `resumes` bucket max file size set to 1 MB in the Supabase dashboard. Cannot be bypassed by direct API calls.

Rationale: 3 slots × 1 MB = 3 MB bounded storage per user. A legitimate resume PDF, including graphically designed ones, rarely exceeds 1.5 MB. See [ADR 0003](adr/0003-pdf-size-limit.md).

### Quick Cast Links

**20 links per user.** Enforced in the UI before insert. Varchar limits on fields in DB migration.

### Music Tracks

**50 tracks per user.** Enforced in the UI before insert. Varchar limits on fields in DB migration.

### Scratch Pad

**8,000 chars each for notes and checklist JSON.** One row per user in the `scratch_pad` table. Enforced at two layers:

1. **Frontend** — `slice(0, SCRATCH_PAD_LIMIT)` on every keystroke in `ScratchPad` component (`src/pages/JobLogPage.tsx`), constant imported from `src/services/scratchPadService.ts`.
2. **DB** — `check (char_length(notes) <= 8000)` and `check (char_length(list) <= 8000)` constraints in `supabase/migrations/20250526000001_scratch_pad.sql`.

Checklist items are serialised as JSON into the `list` column. At 8,000 chars that accommodates roughly 80–100 typical checklist items. localStorage is used as a seed cache on first render; DB is the source of truth after hydration.

---

## Deferred Decisions

### Abandoned User Purging

Not implemented. With field limits and the 1 MB PDF cap, an abandoned user costs at most ~12 MB. At current scale this is acceptable.

**Revisit trigger:** 500+ registered users with low retention.

**Implementation path when needed:**
1. Add `last_seen_at` column to a `profiles` table, updated on each authenticated page load.
2. Add a pg_cron job that deletes auth users (cascades to all tables via `on delete cascade`) inactive for 90+ days.

### All-Time Hours Materialization

`StatsPage` currently fetches all workday rows to compute all-time total hours. Workday rows are ~100 bytes each, so even 5 years of daily sessions (~1,800 rows) is negligible payload. No action needed yet.

**Revisit trigger:** Users with 2+ years of data reporting slow Stats page loads.

**Implementation path when needed:**
- Add a `user_stats` table with a `total_hours` float column, updated on each punch-out.
- `fetchWorkdays` then only needs the last 365 rows for streak and charts.

---

## Enforcement Layers Summary

| Limit type | Frontend | Service | DB |
|---|---|---|---|
| Field char limits | `maxLength` | `JOB_LIMITS` validation | `varchar(N)` |
| Job cap (1,000) | Count check before draft | `count(*)` before insert | — |
| PDF size (1 MB) | Size check before upload | — | Bucket policy |
| Quick cast row cap (20) | Count check before insert | — | — |
| Music track row cap (50) | Count check before insert | — | — |
| Scratch pad chars (8,000 each) | `slice` on keystroke | — | `check` constraint |

---

## Supabase Dashboard Checklist

These limits live outside the codebase and must be set manually:

- [ ] Storage > Buckets > `resumes` > max file size: **1 MB**

If this setting is lost or the bucket is recreated, the frontend check in `resumeService.ts` is the only remaining guard.
