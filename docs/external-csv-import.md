# External CSV Import

## Goal

Allow job hunters to import existing job tracking data from any CSV source (LinkedIn exports, Google Sheets, Notion, Excel, custom spreadsheets) without losing anything. This is an onboarding-critical feature — someone mid-hunt with 50 applications should be able to switch to FJH without starting over.

---

## User Flow

1. User navigates to `/import` (linked from Settings and post-signup onboarding)
2. Uploads any `.csv` file
3. We parse headers + first 10 rows and render their sheet as a preview
4. Haiku auto-positions app-field lenses over the best-match columns
5. User drags/adjusts lenses — live preview updates in real time
6. Required fields (`company`, `title`) must be placed before import is enabled
7. User confirms → import runs row by row → results panel shows counts + errors

---

## Constraints

- **Desktop only** — no mobile support. Gate with existing `MobileUnsupported` pattern.
- **Whole columns only** — no splitting, no regex extraction, no multi-column merging.
- **Jobs only** — contacts out of scope for v1.
- **No XP awarded** — same as the internal CSV import.

---

## App Fields (Import Targets)

| Field | DB Column | Required | Type | Notes |
|---|---|---|---|---|
| Company | `company` | YES | varchar(100) | |
| Title | `title` | YES | varchar(150) | |
| Status | `status` | no | enum | Normalized by Haiku + fallback map — unknown → `APPLIED` |
| Date Applied | `date_applied` | no | YYYY-MM-DD | Invalid dates → today |
| Salary | `salary` | no | varchar(20) | Strip non-numeric, strip K suffix |
| Posting URL | `posting_url` | no | varchar(500) | |
| Rating | `rating` | no | integer 0–5 | Clamp out-of-range values |
| Description | `description` | no | varchar(5000) | |
| Notes | `notes` | no | varchar(2000) | Also the catch-all for unmatched columns |

Any column the user does not map (or Haiku cannot confidently match) gets concatenated into `notes` as `ColumnName: value` pairs, separated by newlines. This is the safety net — nothing is silently lost.

---

## Haiku Integration

### Role
Haiku reads the CSV headers + 3 sample rows and returns a JSON mapping of `their column → our field`. This auto-positions the lenses before the user touches anything. The user reviews and adjusts — they never start cold.

### Prompt shape
```
You are mapping CSV columns to a job tracking app's fields.

App fields: company, title, status, date_applied, salary, posting_url, rating, description, notes, skip

Rules:
- Map each column to exactly one app field or "skip"
- If a column clearly matches a field, use it
- If unsure, use "notes"
- "company" and "title" are required — only map them if you are confident
- Return JSON only, no explanation

Headers: ["Company Name", "Position", "Applied", "Salary Range", "Link", "Recruiter"]
Sample rows:
  ["Google", "Software Engineer", "2024-01-15", "$120-150k", "https://...", "Jane Smith"]
  ["Meta", "Frontend Dev", "2024-02-01", "140K", "https://...", ""]
```

### Expected response
```json
{
  "Company Name": "company",
  "Position": "title",
  "Applied": "date_applied",
  "Salary Range": "notes",
  "Link": "posting_url",
  "Recruiter": "notes"
}
```

### Guardrails
- Parse response as JSON — if malformed, fall back to all columns → `notes` and let user map manually
- Any field name not in our known set → force to `notes`
- Never let Haiku map two columns to the same required field — last one wins, flag the conflict to user
- `company` and `title` mappings from Haiku are suggestions only — user must confirm placement of required fields

---

## UI: Column Lens Overlay

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  IMPORT — Step 2 of 3: Map Your Columns                     │
│                                                             │
│  Drag the app field labels onto the columns below.          │
│  Required fields are highlighted.                           │
│                                                             │
│  [ COMPANY* ] [ TITLE* ] [ STATUS ] [ DATE ] [ SALARY ] ... │
│                                                             │
│ ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│ │ Company Name │ Position     │ Applied      │ Recruiter  │ │
│ ├──────────────┼──────────────┼──────────────┼────────────┤ │
│ │ Google       │ SWE          │ 2024-01-15   │ Jane Smith │ │
│ │ Meta         │ Frontend Dev │ 2024-02-01   │            │ │
│ │ Apple        │ iOS Engineer │ 2024-02-10   │ Bob Jones  │ │
│ └──────────────┴──────────────┴──────────────┴────────────┘ │
│                                                             │
│  [ IMPORT 47 ROWS ]  ← disabled until required fields placed│
└─────────────────────────────────────────────────────────────┘
```

### Lens behaviour
- Each lens is a draggable pill that sits above a column header
- When a lens is over a column, that column highlights and shows a formatted preview of the data (status badge, date formatted, salary with K)
- Required lenses (`COMPANY*`, `TITLE*`) have a distinct border color (secondary) — import button stays disabled until both are placed
- A column can only hold one lens — dropping a second lens on an occupied column displaces the first back to the tray
- Unoccupied columns are implicitly `notes` — shown with a faint `→ notes` indicator
- Lenses can be dragged back to the tray to unmap a column

### Preview formatting
As lenses are placed, the column data renders formatted:
- `status` → pill badge matching app status colors
- `date_applied` → parsed and shown as YYYY-MM-DD (invalid shown in warning color)
- `salary` → numeric only, shown as `$XK`
- `rating` → star or numeric 0–5 (out of range shown in warning color)
- All others → plain text, truncated to fit column

---

## Implementation Plan

### Phase 1 — Parse + Haiku mapping
- `src/lib/csvImport.ts` — CSV parser (reuse `parseCSVRow` from `csvData.ts`), header extraction, sample row slicing
- `src/lib/csvImport.ts` — `getAiColumnMapping(headers, sampleRows)` — calls Haiku, validates response, returns safe mapping
- Unit tests for parser and guardrail validation

### Phase 2 — Import page + lens UI
- `src/pages/ImportPage.tsx` — three-step wizard: Upload → Map → Confirm
- `src/components/import/ColumnLens.tsx` — draggable lens pill (HTML5 drag-and-drop, no library needed)
- `src/components/import/SheetPreview.tsx` — renders CSV rows as a table, accepts active mapping to show formatted previews
- Route: `/import` added to `App.tsx` before auth routes (public? or auth-gated — probably auth-gated since it writes to DB)

### Phase 3 — Import execution
- Reuse `insertJob` from `jobService.ts`
- Notes concatenation: `Object.entries(unmappedCols).map(([k, v]) => \`${k}: ${v}\`).join('\n')`
- Result panel: jobs imported, jobs skipped, first 5 errors surfaced

### Phase 4 — Entry points
- Settings → DATA section: "Import from external CSV" link → `/import`
- Post-signup onboarding: optional step "Already tracking jobs somewhere? Import them →"

---

## Open Questions

- Should `/import` be reachable without auth (upload + map locally, then prompt to sign up before writing)? Could be a strong conversion moment.
- Do we want a "download sample CSV" link so users know what a clean import looks like?
- Cap on import row count? Current `JOB_CAP` is 1000 — surface this clearly if a user's file exceeds it.
