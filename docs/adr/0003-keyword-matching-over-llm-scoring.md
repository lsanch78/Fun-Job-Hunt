# ADR 0003: Keyword matching over LLM or embedding-based scoring

## Status
Accepted

## Context
Incoming job postings need a match score against the user's resume to power the configurable threshold and surface relevant jobs in the Review queue. Several scoring approaches were evaluated.

## Decision
Use local keyword matching to compute match scores. Extract keywords from the user's resume (skills, technologies, job titles, domain terms). For each incoming job posting, count keyword overlaps against the job description. Normalize to a 0–100 score. Highlight matched keywords in the Review queue card.

## Alternatives considered
- **LLM scoring (GPT-4o mini)**: ~$0.0003 per job. Accurate, can reason about fit (e.g. experience level mismatch). Adds per-job API latency and external dependency. Rejected for v1 — the Review queue itself is the primary quality filter, and search profiles already provide coarse targeting.
- **Embeddings (OpenAI text-embedding-3-small)**: ~$0.00001 per job. Semantically aware, fast, cheap. Captures "React" vs "React.js" equivalence. Rejected for v1 in favor of simplicity — keyword matching is transparent and debuggable, embeddings require vector infrastructure.
- **No scoring**: Every job matching the search profile hits the Review queue unscored. Rejected because the configurable threshold is a first-class feature that requires a numeric score.

## Consequences
- Match scores are computed with zero API cost and zero latency.
- Scores are transparent — the user can see exactly which keywords matched via highlighting in the Review queue.
- Keyword matching misses semantic equivalence ("frontend engineer" vs "UI developer"). Accepted trade-off for v1.
- If keyword matching proves too noisy, the upgrade path is embedding-based scoring — the score field in the data model is the same, only the computation changes.
