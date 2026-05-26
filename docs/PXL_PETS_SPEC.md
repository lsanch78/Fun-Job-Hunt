# Pxl Pets — Implementation Plan

## Context

The Story page currently shows an S-path rank progression map with 11 nodes. It is being replaced with **Pxl Pets** — a pet-raising mini-game that lives on the `/story` route. The map is removed entirely; the "I Got a Job!" button remains.

The goal is to add a "surprisingly deep" pet layer that rewards consistent job-hunting behavior (XP-driven), allows cosmetic customization (Hats + color variants purchased with Coins), and enables shareability (public URL + GIF export).

---

## Decisions Locked

| Question | Answer |
|---|---|
| Pet location | Replaces Story page rank map |
| "I Got a Job!" button | Kept at bottom |
| XP pool | Job-hunt XP drives user rank. Pets use XP indirectly (level = f(adoption date + XP events after adoption)) |
| Currency | **Coins** — separate from XP. Earned from job-hunt actions. Spent on cosmetics + pet adoption |
| Marketplace cosmetics | Hats + color variants (per pet) |
| Shareability | Public live-state URL (`/share/:userId`) + client-side animated GIF export |
| Pet pen layout | One shared pen; all pets roam autonomously |
| Pet selection | One-time pick (Dog or Cat) on first visit. Additional pets cost Coins |
| Pet behaviors | Idle walk animation, happiness meter (user-level, decays after 3 days no punch-in), reactions to job events |
| Sprite format | TypeScript pixel arrays rendered to `<canvas>` |
| GIF generation | Client-side encoder (gif.js or pure-TS) |
| Public data access | RLS on `pets` table: SELECT public, writes owner-only |
| Pet customization | Rename, change hat, change color variant, view stats, release (with confirmation) |
| Happiness scope | User-level (all pets equally happy/sad) |
| Pet adoption cost | First free; subsequent pets cost increasing Coins |

---

## Architectural Constraint: Loose Coupling

The entire Pxl Pets feature must be a self-contained island. Existing code should not depend on pet code — only pets depend on existing infrastructure.

**Rules:**
- `petService.ts` reads `profiles.coins` and `supabase` directly — nothing imports FROM petService except pet components and the Story page
- Coin awards in `jobService.ts` and `workdayService.ts` are ONE-WAY fire-and-forget calls to `petService.awardCoins` / `petService.recalculateHappiness` — no return values consumed, wrapped in try/catch so pet failures never break job or workday flows
- `PenCanvas` has zero imports from job/workday/XP code — it only receives `userId` and `pets` as props
- `PetSharePage` has no NavBar, QuickCast, WorkdayBar imports — fully standalone
- All pet types live in `src/types/pets.ts` — never in `src/types/index.ts`
- All pet config lives in `src/config/pets.ts` — never in `src/config/game.ts` (except the COINS earn-rates block which belongs with other XP/earn rates)
- Removing the entire `src/components/pets/` folder and `src/services/petService.ts` must leave the rest of the app working with zero broken imports

---

## New Files to Create

```
src/
├── pages/
│   └── PetSharePage.tsx          ← public /share/:userId route (no auth required)
├── components/
│   └── pets/
│       ├── PenCanvas.tsx         ← shared canvas pen with autonomous pet movement
│       ├── PetSprite.ts          ← pixel array definitions for Dog + Cat (all frames)
│       ├── PetCustomizePanel.tsx ← click-pet panel: rename, hat, color, stats, release
│       ├── AdoptModal.tsx        ← species + name picker (first pet free, subsequent = Coin cost)
│       └── Marketplace.tsx       ← browse + buy Hats and color variants with Coins
├── services/
│   └── petService.ts             ← CRUD for pets, coins balance, marketplace purchases
├── config/
│   └── pets.ts                   ← tunable constants: coin costs, pet cap, happiness decay days, marketplace catalog
└── types/
    └── pets.ts                   ← Pet, Cosmetic TypeScript interfaces
```

---

## Database Schema (new Supabase migrations)

### `pets` table
```sql
id            uuid primary key default gen_random_uuid()
user_id       uuid references auth.users not null
species       text not null check (species in ('dog', 'cat'))
name          varchar(30) not null
adopted_at    timestamptz not null default now()
adoption_xp   int not null default 0
hat_id        text null         -- nullable = no hat equipped
color_id      text not null default 'default'
last_happy_at timestamptz not null default now()
```

RLS:
- `SELECT`: anon and authenticated can read all rows (public share)
- `INSERT/UPDATE/DELETE`: authenticated users, `user_id = auth.uid()` only

### `profiles` table additions
```sql
coins int not null default 0
```

### `owned_cosmetics` table
```sql
user_id  uuid references auth.users not null
item_id  text not null
primary key (user_id, item_id)
```

RLS: SELECT/INSERT/DELETE for `user_id = auth.uid()` only.

### No DB table for the cosmetics catalog — defined in `src/config/pets.ts` (code-only)

---

## Critical Files to Modify

| File | Change |
|---|---|
| `src/pages/StoryPage.tsx` | Replace rank-map JSX with `<PenCanvas>` and pet controls. Keep "I Got a Job!" section at bottom. |
| `src/App.tsx` | Add `/share/:userId` route (unprotected). No route rename needed. |
| `src/config/game.ts` | Add `COINS` block with per-action coin awards (ADD_JOB, STATUS_UPGRADE, STREAK_7_DAY, FIRST_OFFER). |
| `src/types/index.ts` | Add `coins: number` to `Profile` interface. |
| `src/services/jobService.ts` | After XP-earning events, fire-and-forget `petService.awardCoins(userId, COINS.ADD_JOB)`. Wrapped in try/catch — pet failures never propagate. |
| `src/services/workdayService.ts` | On punch-in, fire-and-forget `petService.recalculateHappiness(userId)`. Same try/catch isolation. |
| `CONTEXT.md` | Add Pet, Pen, Happiness, Coin, Pxl Pet glossary entries. |

---

## Component Architecture

### `PenCanvas.tsx`
- `<canvas>` element sized to fill the Story page (minus header + bottom button)
- Pets rendered as scaled-up pixel arrays (8×8 → display at 32×32px for visibility)
- Autonomous movement: each pet has `{x, y, vx, vy}` local state, bounces off pen walls
- Idle animation cycles through sprite frames at ~4fps using `requestAnimationFrame`
- Click detection: `canvas.onClick` → hit-test pet positions → open `PetCustomizePanel`
- Pen border rendered as thick pixel border matching theme `--color-border`
- Happiness overlays: at happiness < 50, render a small sad face above each pet

### `PetSprite.ts`
```ts
// Each frame: 8×8 pixel array of color indices
// Color palettes: { default: string[], orange: string[], ... }
export const DOG_FRAMES: number[][][] = [ frame1, frame2, frame3, frame4 ]
export const CAT_FRAMES: number[][][] = [ frame1, frame2, frame3, frame4 ]
export const DOG_PALETTES: Record<string, string[]> = { default: [...], golden: [...], dark: [...] }
export const CAT_PALETTES: Record<string, string[]> = { default: [...], orange: [...], white: [...] }
// Hat overlays: 4×4 pixel arrays, positioned at top of sprite
export const HATS: Record<string, { pixels: number[][], palette: string[] }> = { ... }
```

### `petService.ts` key functions
```ts
fetchPets(userId): Promise<Pet[]>
adoptPet(userId, species, name, currentXp): Promise<Pet>  // deducts coins if not first pet
releasePet(petId, userId): Promise<void>
updatePet(petId, patch): Promise<Pet>                      // rename, hat_id, color_id
awardCoins(userId, amount): Promise<void>                  // increments profiles.coins
getCoins(userId): Promise<number>
purchaseCosmetic(userId, itemId, cost): Promise<void>      // deducts coins, inserts to owned_cosmetics
getOwnedCosmetics(userId): Promise<string[]>
recalculateHappiness(userId): Promise<void>                // called on punch-in; resets last_happy_at
computeHappiness(lastHappyAt: string): number              // pure fn, used client-side on render
```

### Happiness logic
- `last_happy_at` is the only persisted field (not a raw 0–100 number)
- On punch-in: update `last_happy_at = now()` for all user pets
- On render: `happiness = max(0, 100 - (daysSince / 3) * 100)` where `daysSince = (now - last_happy_at) / 86400000`
- At happiness < 50, render sad face overlay above pet sprite

---

## Coin Economy

`src/config/game.ts` addition:
```ts
export const COINS = {
  ADD_JOB: 1,
  JOB_STATUS_UPGRADE: 5,
  STREAK_7_DAY: 20,
  FIRST_OFFER: 50,
} as const
```

`src/config/pets.ts`:
```ts
export const PET_ADOPT_COST = 100        // second pet costs 100, third 200 (n * 100)
export const PET_CAP = 10                // max pets per user (n, to be tuned)

export const HATS_CATALOG = [
  { id: 'party_hat',  name: 'Party Hat',  cost: 50  },
  { id: 'crown',      name: 'Crown',      cost: 150 },
  { id: 'cowboy',     name: 'Cowboy Hat', cost: 100 },
]

export const COLOR_CATALOG = [
  { id: 'golden', name: 'Golden', species: 'dog', cost: 75 },
  { id: 'dark',   name: 'Dark',   species: 'dog', cost: 75 },
  { id: 'orange', name: 'Orange', species: 'cat', cost: 75 },
  { id: 'white',  name: 'White',  species: 'cat', cost: 75 },
]
```

---

## Pet Level Formula

```ts
// In petService.ts or a pure util in pets.ts
function petLevel(adoptedAt: string, userXp: number, adoptionXp: number): number {
  const xpSinceAdoption = userXp - adoptionXp
  const daysSinceAdoption = Math.floor((Date.now() - new Date(adoptedAt).getTime()) / 86400000)
  const combined = xpSinceAdoption + (daysSinceAdoption * 2)
  return levelFromCombined(combined)  // thresholds array in pets.ts, max level 20
}
```

`adoption_xp` (user's total XP at time of adoption) stored on the `pets` row.

---

## Public Share Route

- Route: `/share/:userId` — added to `App.tsx` as an unprotected `<Route>` (no `ProtectedRoute` wrapper)
- `PetSharePage.tsx` fetches pets by userId using public RLS (no session required)
- Renders a read-only `PenCanvas` (no click handlers, no customization panel)
- "Export GIF" button triggers client-side gif encoding
- No NavBar, QuickCast, or WorkdayBar on this page

---

## GIF Export

- Library: `gif.js` (npm: `gif.js` + `@types/gif.js`)
- Steps: capture one canvas `ImageData` per animation frame (4 frames) → encode → `URL.createObjectURL(blob)` → trigger download
- Triggered by "Export GIF" button on both the owner's Story page and the public share page

---

## Order of Implementation

1. DB migrations: `pets` table, `owned_cosmetics` table, `profiles.coins` column
2. `src/types/pets.ts` — Pet, CosmeticItem interfaces
3. `src/config/pets.ts` — pet cap, adoption cost, marketplace catalog, level thresholds
4. `src/config/game.ts` — add COINS block
5. `src/services/petService.ts` — full service layer
6. `src/components/pets/PetSprite.ts` — pixel art for Dog + Cat (4 walk frames each, hat overlays)
7. `src/components/pets/PenCanvas.tsx` — canvas renderer + rAF loop + autonomous movement
8. `src/components/pets/AdoptModal.tsx` — species picker, name input, coin cost display
9. `src/components/pets/PetCustomizePanel.tsx` — rename, hat, color, stats, release
10. `src/components/pets/Marketplace.tsx` — buy hats + color variants with Coins
11. `src/pages/StoryPage.tsx` — replace rank map with PenCanvas + Marketplace; keep "I Got a Job!" section
12. `src/pages/PetSharePage.tsx` — public read-only pen + GIF export
13. `src/App.tsx` — add `/share/:userId` route
14. `src/services/jobService.ts` — fire-and-forget coin awards
15. `src/services/workdayService.ts` — fire-and-forget happiness reset on punch-in
16. `CONTEXT.md` — add Pxl Pet domain terms

---

## Verification

1. **First visit flow**: Open `/story` with no pets → AdoptModal appears → pick Dog → name it → canvas renders pet walking
2. **Coin earning**: Add a job → check `profiles.coins` increments by 1 in Supabase dashboard
3. **Marketplace**: Buy a hat → `owned_cosmetics` row created → hat appears on pet in pen
4. **Additional pet**: Click "+ Adopt" → coin cost shown → adopt → second pet appears in shared pen
5. **Happiness decay**: Manually set `last_happy_at` to 4 days ago in DB → sad face renders above pets on page load
6. **Happiness restore**: Punch in → `last_happy_at` resets → happy faces
7. **Share URL**: Visit `/share/:userId` in incognito → pen renders (no login prompt)
8. **GIF export**: Click "Export GIF" → browser downloads animated `.gif` of pet idle loop
9. **Release pet**: Click pet → panel opens → release with confirmation → pet removed from pen
10. **"I Got a Job!" button**: Still functional — triggers fanfare + sets `employed = true`
11. **Loose coupling check**: Delete `src/components/pets/` and `src/services/petService.ts` → app builds with zero TS errors (except the two fire-and-forget call sites in jobService + workdayService, which are wrapped and can be removed as one-liners)
