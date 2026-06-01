# Contact Recommendation Architecture

## Overview

A premium-only background service that surfaces relevant people to reach out to at companies a user has applied to. The system is designed around a **three-layer cache** that makes it progressively cheaper as usage grows — the product gets less expensive per user at scale.

## User Flow

1. User right-clicks a job row → **Find Contacts** (single job, immediate)
2. User clicks **SCAN 24H** on the Network page → batch process all jobs from the last 24 hours

Both paths write to the same `recommended_contacts` table and appear in the **Recommended Contacts** section of the Network page in real time via Supabase Realtime.

---

## Three-Layer Cache

```
Request to find contacts for a job
          │
          ▼
┌─────────────────────────────┐
│  Layer 1: Job already done? │  recommended_contacts WHERE job_id = X
│  TTL: permanent             │  → HIT: skip entirely, free
└────────────┬────────────────┘
             │ MISS
             ▼
┌─────────────────────────────┐
│  Layer 2: PDL cache         │  company_contact_cache WHERE company = X
│  TTL: 30 days               │  → HIT: use cached people list, no PDL call
└────────────┬────────────────┘
             │ MISS → call PDL API, store result
             ▼
┌─────────────────────────────┐
│  Layer 3: Claude rec cache  │  claude_rec_cache WHERE company = X
│  TTL: 7 days                │            AND title_bucket = Y
│                             │  → HIT: clone cached ranking, no Claude call
└────────────┬────────────────┘
             │ MISS → call Claude, store ranking
             ▼
      Write to recommended_contacts
```

### Layer 1 — Job deduplication
- Key: `job_id`
- If `recommended_contacts` already has rows for this job, skip entirely
- Free — just a count query

### Layer 2 — PDL contact cache (`company_contact_cache`)
- Key: `company_name` (lowercased)
- TTL: 30 days — people don't change jobs that fast
- Stores raw PDL results (name, title, email, linkedin_url) as JSONB
- Tracks `cache_hits` and `cache_misses` per company for monitoring
- One PDL call serves all jobs at that company, across all users

### Layer 3 — Claude ranking cache (`claude_rec_cache`)
- Key: `company_name` + `title_bucket`
- TTL: 7 days — rankings can go stale faster than contact lists
- Title bucketing maps freeform job titles to coarse role categories so similar roles share the same cache entry
- Tracks `cache_hits` per entry

---

## Title Bucketing

Freeform job titles are normalized into buckets before the Claude cache lookup. This means "Senior Software Engineer II", "Sr. SWE", and "Software Engineer (Senior)" all resolve to the same bucket (`senior_engineer`) and share one Claude cache entry per company.

| Bucket | Example titles |
|---|---|
| `c_suite` | CEO, CTO, Chief Product Officer |
| `vp` | VP Engineering, Vice President |
| `director` | Director of Engineering |
| `staff_engineer` | Staff Engineer, Principal Engineer |
| `eng_manager` | Engineering Manager, EM |
| `manager` | Manager (non-eng) |
| `senior_engineer` | Senior SWE, Sr. Developer |
| `junior_engineer` | Junior Engineer, Associate SWE |
| `product_manager` | Product Manager, PM |
| `designer` | UX Designer, UI Engineer |
| `data_ml` | Data Scientist, ML Engineer, AI |
| `infra` | DevOps, SRE, Platform, Infra |
| `engineer` | Software Engineer, Developer |
| `other` | Anything that doesn't match |

---

## Data Sources

| Layer | Provider | Cost model |
|---|---|---|
| Contact discovery | People Data Labs (PDL) | Per record, ~$0.02–0.10 |
| Contact ranking | Claude Haiku | Per token, ~$0.012/job |
| Storage | Supabase Postgres | Flat monthly |

### Cost at scale (estimated)
At 100 unique companies/month across all users:
- Without cache: 100 PDL calls + 100 Claude calls
- With cache (after warmup): ~10 PDL calls + ~15 Claude calls (some bucket misses)
- Cache efficiency improves continuously as more users apply to the same companies

---

## Edge Functions

### `contact-recommend`
- **Trigger**: manual (right-click → Find Contacts on a job row)
- **Auth**: Bearer token from frontend, verified against `auth.users`
- **Flow**: premium check → PDL search (no cache) → Claude agent loop → write to `recommended_contacts`
- **Note**: intentionally bypasses Layer 2/3 cache — single job lookups are user-initiated and expected to be fresh

### `contact-scan`
- **Trigger**: manual (SCAN 24H button on Network page)
- **Auth**: Bearer token from frontend
- **Flow**: premium check → fetch last 24h jobs → group by company → three-layer cache → write to `recommended_contacts`
- **Monitoring**: returns `cache` stats in response body, displayed in the UI

---

## Database Schema

```sql
-- Raw PDL results per company
company_contact_cache (
  company_name  TEXT UNIQUE,   -- cache key (lowercased)
  contacts      JSONB,         -- array of { name, title, email, linkedin_url }
  fetched_at    TIMESTAMPTZ,   -- for TTL
  cache_hits    INTEGER,       -- monitoring
  cache_misses  INTEGER        -- monitoring
)

-- Claude rankings per company + role bucket
claude_rec_cache (
  company_name    TEXT,
  title_bucket    TEXT,
  recommendations JSONB,       -- array of RecommendedContact
  fetched_at      TIMESTAMPTZ,
  cache_hits      INTEGER,
  UNIQUE (company_name, title_bucket)
)

-- Final output — what users see
recommended_contacts (
  job_id       UUID → jobs,
  user_id      UUID → auth.users,
  company      TEXT,
  name         TEXT,
  title        TEXT,
  email        TEXT,
  linkedin_url TEXT,
  seniority    TEXT CHECK IN ('peer', 'manager'),
  why          TEXT            -- Claude-generated explanation
)
```

---

## Monitoring Cache Efficiency

After each SCAN 24H, the UI displays a live cache report:

```
pdl 3h/1m · ai 5h/2m · 2 skip
```

- `pdl Xh/Ym` — PDL cache hits / misses (Layer 2)
- `ai Xh/Ym` — Claude cache hits / misses (Layer 3)
- `N skip` — jobs skipped because recs already exist (Layer 1)

To query cache efficiency directly in Supabase SQL Editor:

```sql
-- PDL cache hit rate by company
SELECT company_name, cache_hits, cache_misses,
  round(cache_hits::numeric / nullif(cache_hits + cache_misses, 0) * 100, 1) as hit_rate_pct
FROM company_contact_cache
ORDER BY cache_hits + cache_misses DESC;

-- Claude cache hit rate by bucket
SELECT company_name, title_bucket, cache_hits,
  fetched_at
FROM claude_rec_cache
ORDER BY cache_hits DESC;
```

---

## Future Work

- **Swap stub contacts for real API** — PDL is wired in; Proxycurl is the alternative if PDL data quality is insufficient
- **Extend scan windows** — add 3-day, 7-day scan options alongside 24h
- **Multi-user cache sharing** — Layer 2/3 caches are currently per-deployment (shared across all users already); make this explicit in monitoring
- **Cache warming** — pre-populate cache for popular companies (FAANG etc.) proactively
- **Proxycurl fallback** — if PDL returns 0 results, retry with Proxycurl before giving up
