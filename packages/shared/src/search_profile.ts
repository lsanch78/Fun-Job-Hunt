import { z } from 'zod';

export const SOURCES = ['linkedin', 'handshake'] as const;
export type Source = (typeof SOURCES)[number];

export const SearchProfileSchema = z.object({
  id: z.string().uuid().optional(), // absent on create
  name: z.string().min(1, 'Name is required').max(120),
  job_titles: z.array(z.string().min(1).max(120)).max(20).default([]),
  keywords: z.array(z.string().min(1).max(120)).max(50).default([]),
  locations: z.array(z.string().min(1).max(120)).max(20).default([]),
  sources: z
    .array(z.enum(SOURCES))
    .min(1, 'At least one source must be selected')
    .default(['linkedin', 'handshake']),
  active: z.boolean().default(true),
  min_match_score: z
    .number()
    .int()
    .min(0)
    .max(100, 'Threshold must be between 0 and 100')
    .default(50),
  created_at: z.string().optional(), // returned from DB, not sent on write
});

export type SearchProfile = z.infer<typeof SearchProfileSchema>;

/** Shape written to Supabase on insert/update (no id/created_at). */
export const SearchProfileWriteSchema = SearchProfileSchema.omit({
  id: true,
  created_at: true,
});

export type SearchProfileWrite = z.infer<typeof SearchProfileWriteSchema>;
