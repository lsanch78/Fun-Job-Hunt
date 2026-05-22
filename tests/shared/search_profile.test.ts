import { describe, it, expect } from 'vitest';
import {
  SearchProfileSchema,
  SearchProfileWriteSchema,
  SOURCES,
  type SearchProfile,
  type SearchProfileWrite,
} from '@effjobhunt/shared/search_profile';

// ── Fixtures ──────────────────────────────────────────────────────────────

const minimalWrite: SearchProfileWrite = {
  name: 'Frontend roles',
  job_titles: [],
  keywords: [],
  locations: [],
  sources: ['linkedin'],
  active: true,
  min_match_score: 50,
};

const fullProfile: SearchProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Senior Frontend',
  job_titles: ['Frontend Engineer', 'UI Engineer'],
  keywords: ['TypeScript', 'React', 'Node.js'],
  locations: ['Remote', 'San Francisco, CA'],
  sources: ['linkedin', 'handshake'],
  active: true,
  min_match_score: 60,
  created_at: '2025-05-22T00:00:00Z',
};

// ── SOURCES constant ───────────────────────────────────────────────────────

describe('SOURCES', () => {
  it('contains linkedin and handshake', () => {
    expect(SOURCES).toContain('linkedin');
    expect(SOURCES).toContain('handshake');
  });
});

// ── SearchProfileSchema ────────────────────────────────────────────────────

describe('SearchProfileSchema', () => {
  it('accepts a fully populated profile', () => {
    expect(SearchProfileSchema.safeParse(fullProfile).success).toBe(true);
  });

  it('id is optional (absent on create)', () => {
    const { id: _id, ...noId } = fullProfile;
    expect(SearchProfileSchema.safeParse(noId).success).toBe(true);
  });

  it('rejects an empty name', () => {
    const bad = { ...fullProfile, name: '' };
    expect(SearchProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects min_match_score below 0', () => {
    const bad = { ...fullProfile, min_match_score: -1 };
    expect(SearchProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects min_match_score above 100', () => {
    const bad = { ...fullProfile, min_match_score: 101 };
    expect(SearchProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts min_match_score at boundary values 0 and 100', () => {
    expect(SearchProfileSchema.safeParse({ ...fullProfile, min_match_score: 0 }).success).toBe(true);
    expect(SearchProfileSchema.safeParse({ ...fullProfile, min_match_score: 100 }).success).toBe(true);
  });

  it('rejects an invalid source value', () => {
    const bad = { ...fullProfile, sources: ['twitter'] };
    expect(SearchProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty sources array', () => {
    const bad = { ...fullProfile, sources: [] };
    expect(SearchProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an empty locations array', () => {
    expect(SearchProfileSchema.safeParse({ ...fullProfile, locations: [] }).success).toBe(true);
  });

  it('accepts Remote-only locations', () => {
    expect(SearchProfileSchema.safeParse({ ...fullProfile, locations: ['Remote'] }).success).toBe(true);
  });

  it('accepts mixed Remote and city locations', () => {
    expect(
      SearchProfileSchema.safeParse({
        ...fullProfile,
        locations: ['Remote', 'New York, NY', 'Austin, TX'],
      }).success
    ).toBe(true);
  });

  it('defaults locations to [] when omitted', () => {
    const { locations: _l, ...noLocations } = fullProfile;
    const result = SearchProfileSchema.safeParse(noLocations);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locations).toEqual([]);
  });

  it('defaults active to true when omitted', () => {
    const { active: _a, ...noActive } = fullProfile;
    const result = SearchProfileSchema.safeParse(noActive);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(true);
  });

  it('defaults min_match_score to 50 when omitted', () => {
    const { min_match_score: _m, ...noScore } = fullProfile;
    const result = SearchProfileSchema.safeParse(noScore);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.min_match_score).toBe(50);
  });
});

// ── SearchProfileWriteSchema ──────────────────────────────────────────────

describe('SearchProfileWriteSchema', () => {
  it('accepts a minimal write payload', () => {
    expect(SearchProfileWriteSchema.safeParse(minimalWrite).success).toBe(true);
  });

  it('id is stripped from write schema output', () => {
    const withId = { ...minimalWrite, id: '00000000-0000-0000-0000-000000000001' };
    const result = SearchProfileWriteSchema.safeParse(withId);
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as Record<string, unknown>)['id']).toBeUndefined();
  });

  it('created_at is stripped from write schema output', () => {
    const withCreatedAt = { ...minimalWrite, created_at: '2025-05-22T00:00:00Z' };
    const result = SearchProfileWriteSchema.safeParse(withCreatedAt);
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as Record<string, unknown>)['created_at']).toBeUndefined();
  });

  it('rejects an empty name', () => {
    const bad: SearchProfileWrite = { ...minimalWrite, name: '' };
    expect(SearchProfileWriteSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts locations with Remote and multiple cities', () => {
    const good: SearchProfileWrite = {
      ...minimalWrite,
      locations: ['Remote', 'Seattle, WA'],
    };
    expect(SearchProfileWriteSchema.safeParse(good).success).toBe(true);
  });
});
