# Testing Strategy

## Priority Order

1. **Services** — own all business logic; Supabase-mock pattern already established
2. **Lib** — pure functions; cheapest to write, highest confidence return
3. **Hooks** — depend on services being tested first so mocks are trustworthy
4. **Components** — only those with meaningful logic (see bar below)

## Layer Rules

| Layer | Approach | Location |
|---|---|---|
| Services | Unit tests, Supabase mocked via `jest.mock('@/lib/supabase')` | `src/__tests__/services/` |
| Lib | Unit tests, no mocks | `src/__tests__/lib/` |
| Hooks | `renderHook` from `@testing-library/react`, services mocked | `src/__tests__/hooks/` |
| Components | `render` from `@testing-library/react`, services mocked | `src/__tests__/components/` |
| Pages | Integration tests only | `src/__tests__/integration/` |
| Config | Low priority; test only if values have derived logic | `src/__tests__/config/` |
| Contexts | Tested implicitly via hook tests | — |

## Hooks Strategy

Use `renderHook` from `@testing-library/react` (already available via jsdom). Mock services with `jest.mock`. Do **not** test hooks through consuming components — that conflates two layers. Do **not** install `@testing-library/react-hooks` (merged into the main package).

## Component Test Bar

No snapshot tests. Only test components with:
- Modal/wizard state machines
- Form validation branches
- Conditional rendering driven by data

Pure display components get no tests.

## Integration Tests

- Directory: `src/__tests__/integration/` (create when first test is written)
- First target: **job add/edit flow** (core feature, touches jobService + useJobList + useJobDetail + JobDetailModal)
- Second target: **auth flow**

## Coverage Threshold

Start at **30% overall**, enforced in `jest.config.ts`. Ratchet up as coverage grows — purpose is regression prevention, not a blocker.

```ts
// jest.config.ts addition when ready to enforce:
coverageThreshold: {
  global: { lines: 30 },
},
```
