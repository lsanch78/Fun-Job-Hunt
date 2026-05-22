# ADR 0001: Supabase over custom WebSocket server

## Status
Accepted

## Context
The Review queue requires real-time delivery of incoming job postings to the user's browser across mobile and desktop. The VPS runs the scraper and pipeline workers continuously. The frontend is a React app hosted on Vercel.

We needed a real-time transport layer between the VPS worker (which writes new job postings) and the client browser (which displays them as cards).

## Decision
Use Supabase as the database and real-time layer. The VPS workers write directly to Supabase. The React frontend subscribes to Supabase real-time channels for live updates. Accept/reject decisions are written back to Supabase by the frontend or the Telegram bot, and picked up by the pipeline worker via Supabase subscriptions.

## Alternatives considered
- **Custom WebSocket server on the VPS**: Would require building and maintaining connection management, reconnection logic, mobile reliability handling, and auth. Significant engineering overhead for a solved problem.
- **Server-Sent Events + HTTP**: One-directional, requires separate HTTP endpoints for accept/reject. More moving parts than Supabase.
- **Polling**: Too laggy for a real-time review queue UX.

## Consequences
- The VPS becomes a pure worker process — no HTTP server, no WebSocket server, just Playwright and Supabase writes.
- The React frontend can be hosted on Vercel for free, entirely decoupled from the VPS.
- Supabase free tier (500MB, real-time included) is sufficient for a single-user job hunt tool if rejected job postings are pruned periodically.
- If Supabase free tier limits are hit, the upgrade path is Supabase Pro ($25/month) — not a re-architecture.
- Auth comes for free with Supabase, protecting the Review queue and Application log behind login.
