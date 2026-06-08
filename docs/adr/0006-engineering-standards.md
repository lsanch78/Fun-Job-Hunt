# ADR 0006 — Engineering Standards

**Status:** Accepted

## Context

As the codebase grows, without explicit standards, logic leaks into the wrong layers, naming drifts from the product language, types sprawl across files, and testing becomes an afterthought. These standards establish a shared foundation for how all code in this project is written.

## Decision

Adopted a comprehensive set of engineering standards, documented in `CLAUDE.md`. The key decisions:

**Folder structure & data flow** — `src/` is divided into `pages`, `hooks`, `services`, `lib`, `components`, `types`, and `assets` with strict, non-overlapping responsibilities. Data flows one direction: pages → hooks → services → Supabase.

**Ubiquitous language** — code names must mirror UI-facing copy exactly. No synonyms, paraphrasing, or abbreviations. If the UI label changes, the code is renamed with it.

**Type definitions** — all types live in `src/types/` sub-files, re-exported through `src/types/index.ts`. Imported exclusively from `@/types` everywhere in the codebase.

**TDD with Jest** — tests are written before implementation. Tests are never modified to make them pass — only the implementation changes. Auto-commit only when TypeScript compiles clean and all tests pass.

**Branching & commits** — never code on `master`. Branch naming: `feat/`, `bug/`, `refactor/`, `dev/`. Commits are small and atomic. PR descriptions include: Summary, How to Test, and Potential Opportunities For Simplification.

## Alternatives Considered

- **No formal standards** — rejected because inconsistency compounds over time, making the codebase harder to navigate, test, and hand off.
- **Standards defined per-feature** — rejected in favor of upfront global rules that apply uniformly from the start.

## Consequences

- Every file has an unambiguous home and name derived from product language.
- Business logic is always testable in isolation.
- Slightly more upfront discipline required (confirm UI name before creating files, write tests first), but navigability and correctness improve significantly over time.
