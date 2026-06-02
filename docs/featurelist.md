# Fun Job Hunt — Feature List

> Source of truth for free vs. pro gating. Update when adding or changing feature access.

## Summary Table

| Feature | Free | Pro | Notes |
|---------|------|-----|-------|
| **JOB TRACKING** | | | |
| Job log (spreadsheet view) | ✓ | ✓ | Up to 1,000 jobs |
| Job status pipeline (7 stages) | ✓ | ✓ | +50 XP per upgrade |
| Job detail card (inline edit) | ✓ | ✓ | Lazy-loads description/notes |
| Filtering, sorting, search | ✓ | ✓ | |
| Auto-ghost stale applications | ✓ | ✓ | Configurable days threshold |
| Bulk delete | ✓ | ✓ | Shift+click range select |
| CSV export (jobs + contacts) | ✓ | ✓ | |
| **NETWORKING** | | | |
| Contact management | ✓ (8 max) | ✓ (unlimited) | `FREE_CONTACT_CAP = 8` in contactService.ts |
| Contact detail card | ✓ | ✓ | Social links, notes, linked jobs |
| Network visualization map | ✓ | ✓ | Animated node-edge graph |
| Contact ping / last interaction | ✓ | ✓ | |
| Comm exp tracker (0–100+) | ✓ | ✓ | |
| Ping cooldown settings | ✓ | ✓ | 24h / 72h / 1wk / 2wk |
| Link contacts ↔ jobs | ✓ | ✓ | |
| **GAMIFICATION** | | | |
| XP system | ✓ | ✓ | Events: add job +20, status up +50, etc. |
| 11-rank progression | ✓ | ✓ | Rank 5+ unlocks more AI credits |
| Story map (visual rank path) | ✓ | ✓ | S-shaped node layout |
| Rank cutscenes / dialogue | ✓ | ✓ | Branching narrative, choice input |
| Achievements (framework) | ✓ | ✓ | 100 XP each |
| Streak counter | ✓ | ✓ | +200 XP at 7-day milestone |
| Grace days (streak freeze) | ✓ | ✓ | 1 per calendar week |
| XP pop animations | ✓ | ✓ | Floating +XP on actions |
| **STATS & ANALYTICS** | | | |
| Dashboard (overview, outcomes) | ✓ | ✓ | Win rate, ghost rate, interview rate |
| Time tracking stats | ✓ | ✓ | Streak, hours this week/month/total |
| Activity insights | ✓ | ✓ | Apps/hr, busiest day, best week |
| Job quality metrics | ✓ | ✓ | Avg rating, high conviction count |
| Network stats | ✓ | ✓ | Champions, allies, top contact |
| 30-day applications chart | ✓ | ✓ | Bar chart with hover tooltips |
| Workday log table | ✓ | ✓ | All sessions with duration |
| **TIME TRACKING** | | | |
| Workday punch clock (HUD) | ✓ | ✓ | Always visible in bottom bar |
| Punch in / punch out | ✓ | ✓ | Auto punch-out after 15 min idle |
| Activity tracking (idle detection) | ✓ | ✓ | Tracks clicks, nav, form input |
| Derived break calculation | ✓ | ✓ | Based on configurable shift length |
| **AI ASSISTANT** | | | |
| Cover letter generation | ✓ (10–30/mo) | ✓ (unlimited) | Credit limit grows with rank |
| "Why good fit" generation | ✓ (10–30/mo) | ✓ (unlimited) | |
| Custom prompt mode | ✓ (10–30/mo) | ✓ (unlimited) | Up to 3,000 chars, saved per user |
| Job description cleaning | ✓ (10–30/mo) | ✓ (unlimited) | Haiku model, fast |
| AI history (localStorage) | ✓ | ✓ | Last 30 entries |
| Resume context in AI | ✓ | ✓ | Extracted text cached locally |
| Right-click quick-gen | ✓ (10–30/mo) | ✓ (unlimited) | Reads clipboard for JD |
| AI mode (AI-first / off) | ✓ | ✓ | Hides all AI if set to off |
| BYOK (OpenAI or Anthropic) | ✓ | ✓ | Keys stored locally, bypass limits |
| PDF / Word export (cover letters) | ✗ | ✓ | Buttons disabled with warning color and tooltip for free users |
| **RESUME** | | | |
| Resume slot A (upload + preview) | ✓ | ✓ | PDF/DOCX, max 1 MB |
| Resume slots B & C | ✗ | ✓ | 3 slots total on Pro |
| Custom slot names | ✓ | ✓ | |
| PDF text extraction (AI context) | ✓ | ✓ | Cached locally |
| **QUICK CAST HOTBAR** | | | |
| Quick links (up to 20) | ✓ | ✓ | Click to copy URL |
| Icon picker (19 icons) | ✓ | ✓ | |
| Link persistence (DB + local) | ✓ | ✓ | |
| **JOURNAL / SCRATCH PAD** | | | |
| Freeform notes | ✓ | ✓ | 50,000 char max, DB sync |
| Checklist with drag-to-reorder | ✓ | ✓ | |
| Resizable scratch pad | ✓ | ✓ | 120–600px, persisted |
| Sync status indicator | ✓ | ✓ | |
| **THEMES** | | | |
| Classic Terminal (green/black) | ✓ | ✓ | Default |
| NES RPG | ✗ | ✓ | |
| Game Boy | ✗ | ✓ | |
| Arcade Cabinet | ✗ | ✓ | |
| High Contrast | ✗ | ✓ | |
| Custom color editor (8 slots) | ✗ | ✓ | |
| **SETTINGS & DATA** | | | |
| Profile / username | ✓ | ✓ | |
| Auto-ghost config | ✓ | ✓ | |
| Ping cooldown config | ✓ | ✓ | |
| CSV export | ✓ | ✓ | |
| Delete all jobs | ✓ | ✓ | Requires confirmation |
| Delete all contacts | ✓ | ✓ | Requires confirmation |
| Full reset (nuclear) | ✓ | ✓ | Requires typed phrase |
| **ONBOARDING** | | | |
| Interactive tutorial (4 screens) | ✓ | ✓ | Re-triggerable via nav |
| **MOBILE** | | | |
| Mobile job log | ✓ | ✓ | Simplified list layout |
| Mobile network page | ✓ | ✓ | |
| Mobile scratch pad | ✓ | ✓ | |
| **MISC** | | | |
| Sound effects (retro SFX) | ✓ | ✓ | Mutable |
| Credits page | ✓ | ✓ | |
| Landing page with demos | ✓ | ✓ | Public |

---

## AI Credit Tiers (proxy provider)

| Rank | Monthly AI Generations |
|------|------------------------|
| 1–4 | 10 |
| 5–6 | 20 |
| 7+ | 30 |
| Pro | Unlimited |

---

## Pro Gates Summary

| Gate | Free Limit | Pro |
|------|------------|-----|
| Contacts | 8 | Unlimited |
| Resume slots | 1 (slot A) | 3 (A, B, C) |
| AI generations | 10–30/mo | Unlimited |
| Themes | Classic Terminal only | All 5 + custom |
| Cover letter export (PDF/Word) | ✗ | ✓ | |
