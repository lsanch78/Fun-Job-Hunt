# CLAUDE.md — Engineering Standards for effjobhunt

This file defines how we write code in this codebase. These rules apply to every feature, bug fix, and refactor. They are non-negotiable defaults — deviations require explicit discussion.

---

## What to Flag Before Proceeding

These situations require a pause and explicit discussion before writing code:

1. A new file or module needs a name — confirm the UI-facing term first.
2. A pattern already exists elsewhere — propose consolidation instead of duplication.
3. A module is taking on more than one responsibility — propose a split.
4. Two features share similar logic — propose a unified abstraction.
5. A test needs to be modified — tests are never changed to make them pass; only the implementation changes. If the contract itself changed, discuss it first.

---

## Guiding Philosophy

- **Polish over speed.** We do not cut corners to ship faster. Clean, organized, loosely coupled code is always the goal.
- **Single responsibility.** Every module, function, and component does one thing well. If something is doing too much, flag it and propose a split.
- **Proactive simplification.** When working in the codebase, actively look for opportunities to simplify existing code — without being asked.

---

## Folder Structure

All source code lives under `src/`. Each folder has a strict, non-overlapping responsibility.

```
src/
├── assets/      # Static files: images, icons, fonts. No logic.
├── components/  # Shared, reusable UI components. No business logic.
├── config/      # Tweakable app constants: pricing, templates, prompts. No logic.
├── contexts/    # React contexts (providers + consumers). Slow-changing global state.
├── hooks/       # React-specific wiring. Composes services + local state + side effects.
├── lib/         # Pure utility functions. No side effects, no React dependency.
├── pages/       # Route-level components. One file per route. Layout and composition only.
├── services/    # All business logic and external communication (Supabase, APIs).
└── types/       # All TypeScript type definitions.
```

### Data Flow

```
pages → hooks → services → Supabase
         ↓
       lib (pure utilities, usable anywhere)
```

- **Pages** display data. No business logic, no direct Supabase calls.
- **Hooks** bridge React state to services. No direct Supabase calls.
- **Services** own all business logic and data fetching. No React dependencies.
- **Lib** contains pure, stateless utility functions. Runnable in Node with no context.
- **Config** holds tweakable constants that require iteration — pricing tables, templates, prompts. No logic. Imported anywhere.
- **Contexts** hold slow-changing global state shared across the component tree. Consumed via hooks.
- **Types** are shared interfaces. No logic lives here.

---

## Type Definitions

- All types are defined in `src/types/` sub-files (e.g. `types/jobs.ts`, `types/user.ts`).
- All sub-files are re-exported through `src/types/index.ts`.
- **Types are always imported from `@/types` — never from sub-files directly.**
- No type declarations anywhere else in the codebase. No exceptions.

```ts
// ✅ Correct
import { Job, User } from '@/types'

// ❌ Wrong
import { Job } from '@/types/jobs'
type Job = { ... } // defined inline in a component
```

---

## Naming Conventions — Ubiquitous Language

Code language must mirror UI-facing and product-facing language exactly. If a feature is called **"Resume Curation"** in the UI, it is called Resume Curation everywhere in the code — no synonyms, no paraphrasing, no abbreviations.

| Context | Convention | Example |
|---|---|---|
| React component file | PascalCase | `ResumeCuration.tsx` |
| Service file | camelCase + suffix | `resumeCurationService.ts` |
| Hook file | camelCase + prefix | `useResumeCuration.ts` |
| Type name | PascalCase | `ResumeCuration` |
| Test file | mirrors source file | `resumeCuration.test.ts` |

**Rule:** Before naming any new file or module, confirm the UI-facing name first. If the UI copy changes, the code is renamed with it.

---

## Extensibility & Abstraction

- **Do not abstract prematurely.** If a pattern exists in only one place, leave it inline.
- **Extract when a pattern appears in 2+ places.** At that point, flag it and propose a shared abstraction before duplicating.
- When two features use similar-but-duplicated logic trees, stop and propose a unified path (polymorphism, shared service, etc.) before building both separately.

---

## Test-Driven Development

We practice TDD. Tests are written **before** implementation.

### Process
1. Discuss the feature: agree on happy path, unhappy paths, and edge cases **before writing any code**.
2. Write failing tests covering all agreed cases (red).
3. Write the minimum implementation to make them pass (green).
4. Refactor without breaking tests.

### Test Organization
- **Unit tests** — test a single function or module in isolation. Live next to the source file: `resumeCurationService.test.ts`.
- **Integration tests** — test the interaction between layers (e.g. hook + service + Supabase). Live in `src/__tests__/integration/`.
- Test runner: **Jest**.

---

## Versioning & Branching

### Branch Rules
- **Never code on `master`.** Before writing any code, verify the current branch.
- If on `master`, infer an appropriate branch name from the task, confirm it with the user, then create it.

### Branch Naming Convention
| Type | Pattern | Use For |
|---|---|---|
| Feature | `feat/feature-name` | New user-facing functionality |
| Bug fix | `bug/bug-name` | Fixing broken behavior |
| Refactor | `refactor/module-name` | Restructuring existing code |
| Dev tooling | `dev/description` | Dashboards, dev tools, code visualization aids |

### Commits
- Commits are **small and atomic** — one logical unit of work per commit.
- Commit messages are short and descriptive (e.g. `add resume curation service`).
- **Auto-commit when:** TypeScript compiles clean AND all tests pass. Never commit on a red test.
- Larger context and explanation are saved for the PR description.

### Pull Request Template
Every PR description must include:
1. **Summary** — what changed and why
2. **How to Test** — steps to verify the change works
3. **Potential Opportunities For Simplification** — anything that could be cleaner, extracted, or unified
