# ADR 0005: Remove Story Mode

**Date:** 2026-06-07  
**Status:** Accepted

## Context

Story Mode was an ambitious feature that overlaid a narrative RPG layer on top of the job hunt — complete with cutscenes, original music, dialogue scenes, rank-gated unlocks, and a dedicated `/story` route. It was built with genuine care: custom scene components, a Supabase-backed story inputs system, animated overlays, and a full landing page demo section.

However, after reflection, the feature doesn't fit the core purpose of the app. Fun Job Hunt is a productivity tool for people actively job hunting. Story Mode added complexity without adding utility — it was a fun side project embedded inside a tool that users open when they're stressed and need to get things done. The narrative framing ("fulfill your destiny") created a tonal mismatch with the real, anxious experience of job searching.

## Decision

Remove Story Mode entirely:

- Deleted `src/pages/StoryPage.tsx` (~512 lines)
- Deleted `src/components/landing/StoryDemo.tsx` (~445 lines)
- Deleted `src/components/story/` directory (~15 files, ~600 lines)
- Deleted `src/services/storyInputService.ts`
- Deleted Supabase migrations for `story_inputs` column and `set_story_input()` RPC
- Removed `/story` route from `App.tsx`
- Removed STORY nav link from `NavBar.tsx`
- Removed StoryDemo section from `LandingPage.tsx`
- Removed story navigation from `JobLogPage.tsx` and `StatsPage.tsx`
- Removed `playStoryChime()` from `sfx.ts`
- Removed `storyInputs` storage key from `storageKeys.ts`
- Removed `STORY_STEPS` tutorial from `tutorialSteps.ts`
- Removed Story Mode row from the pricing feature table

## Consequences

- ~1,500+ lines of code removed, reducing bundle size and cognitive overhead
- The XpTracker widget remains on JobLogPage and StatsPage — it no longer navigates anywhere on click
- The `story_inputs` Supabase column and `set_story_input()` RPC still exist in the database (the drop migration was deleted along with the add migration). A future cleanup migration should drop these if the table is being maintained
- No production user data is lost — the feature had no user-facing data beyond story input text, which was a minor personalization feature
