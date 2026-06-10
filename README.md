# Fun Job Hunt

**Track your job applications like a video game.** Log applications, earn XP, generate AI-tailored resumes and cover letters, and level up your job hunt in retro style.

**Live app:** [fjobhunt.com](https://www.fjobhunt.com/)

<!-- TODO: add screenshots/GIF of the Job Log, CV builder, and Stats dashboard -->

## Features

- **Job Log** — track every application with status, salary, location, notes, and full job descriptions. Stale applications auto-ghost after 60 days of silence ([ADR-0001](docs/adr/0001-punch-out-at-last-activity-time.md)).
- **CV Builder** — rich resume editor (experiences, projects, education, skills, certifications, awards) with PDF export and .docx import.
- **AI Resume Tailoring** — paste a job description and get a one-page resume variant with bullets reordered and reworded to match, within a strict bullet budget.
- **AI Cover Letters** — full letter generation or a strategic "angle" recommendation, streamed token-by-token, editable before export.
- **Network** — contact tracker with engagement tiers (Stranger → Champion) visualized as a d3-force physics graph.
- **Stats** — interview rate, ghost rate, streaks, session-based time tracking, and daily application charts.
- **Gamification** — XP, daily streaks, weekly targets, and milestone popups to keep the grind fun.
- **Themes** — five visual themes, including a retro CRT terminal aesthetic, with sound effects.
- **Billing** — free tier (30 AI requests/month) and a Pro tier via Stripe subscriptions.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| AI | Anthropic Claude via a server-side proxy, with a provider abstraction supporting OpenAI and bring-your-own-key |
| Payments | Stripe (Checkout, Customer Portal, webhooks) |
| Testing | Jest + React Testing Library |
| Deploy | Vercel (frontend), Supabase (functions + DB) |

## Architecture

All source lives under `src/` in strictly layered folders:

```
pages → hooks → services → Supabase
         ↓
       lib (pure utilities, usable anywhere)
```

- **Pages** compose UI; no business logic or data access.
- **Hooks** bridge React state to services.
- **Services** own all business logic and Supabase/API calls; no React dependencies.
- **Lib** is pure, stateless utilities runnable in plain Node.

Full conventions are in [CLAUDE.md](CLAUDE.md). Significant design decisions are recorded as ADRs in [docs/adr/](docs/adr/).

## Local Setup

Requires Node 20+ and a [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/lsanch78/effjobhunt.git
cd effjobhunt
npm install
cp .env.example .env   # fill in your Supabase URL, anon key, and Google client ID
npm run dev
```

Apply the database schema with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Edge functions in [supabase/functions/](supabase/functions/) (AI proxy, Stripe webhooks, checkout) read their secrets from Supabase function environment variables.

### Tests

```bash
npm test
npm run test:coverage
```

The per-layer testing approach is documented in [src/__tests__/testingStrategy.md](src/__tests__/testingStrategy.md).

## Engineering Practices

This project is built with a disciplined, AI-assisted workflow:

- **TDD** — tests are written before implementation; the red-green-refactor process is defined in [CLAUDE.md](CLAUDE.md).
- **ADRs** — non-obvious design decisions are documented in [docs/adr/](docs/adr/).
- **PR-based flow** — all work happens on `feat/`, `bug/`, `refactor/`, or `dev/` branches and lands via pull requests with a structured template.
- **AI pair programming** — much of the code is written with Claude Code, governed by the engineering standards in [CLAUDE.md](CLAUDE.md); AI-assisted commits carry a `Co-Authored-By` trailer.

## License

[MIT](LICENSE)
