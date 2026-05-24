# ADR 0002: "Employed" rank is a manual toggle, not an XP threshold

## Status
Accepted

## Context
The app has 11 ranks. Ranks 1–10 are earned by accumulating XP. Rank 11 ("Employed") represents the user getting a job — the terminal goal of the entire app.

Making Employed an XP threshold would mean a highly active user could accidentally hit it without actually getting a job, breaking the narrative.

## Decision
Employed is triggered exclusively by a manual toggle in Settings ("I got the job"). It is not reachable through XP accumulation alone.

## Consequences
- The rank system has two distinct mechanics: XP-gated (ranks 1–10) and intent-gated (rank 11).
- Unlocking Employed can trigger a special celebration state in the UI distinct from normal rank-ups.
- Users must self-report employment honestly — no verification. Accepted for a personal tracking tool.
