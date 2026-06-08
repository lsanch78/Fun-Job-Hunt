# ADR 0004: Flatten AI usage limit to 30/month for all free users

## Status
Accepted

## Context
AI usage limits were tiered by rank (derived from job count): 10/month for Rank 1–4, 20/month at Rank 5–6, and 30/month at Rank 7+. The intent was to reward engaged users with more AI capacity.

In practice this created more problems than it solved:
- The rank-based tiers required the DB function to proxy job count as a rank signal, coupling the AI gate to the jobs table in a non-obvious way.
- The UI labels on the Story page ("20 free AI credits/mo", "30 free AI credits/mo") were accurate but felt like misleading gamification — rewards that users had to discover rather than a clear stated limit.
- Most active users (those who actually use the AI feature) tend to have enough jobs tracked to qualify for the higher tiers anyway, making the lower tiers a source of unexpected friction rather than meaningful differentiation.

## Decision
Replace the tiered `check_and_increment_ai_usage` DB function with a single flat limit of 30/month for all free users (migration `20260607000001_ai_usage_flat_limit_30`). Remove the rank reward labels from the Story page. Simplify the client-side constants to a single `AI_MONTHLY_LIMIT = 30`.

## Consequences
- All free users get 30 AI uses/month from day one, regardless of rank or job count.
- No rank-based AI rewards to display or maintain.
- Reduces DB function complexity; the jobs table is no longer queried during AI rate-limit checks.
- Users who were previously capped at 10 or 20 get an immediate uplift to 30.
