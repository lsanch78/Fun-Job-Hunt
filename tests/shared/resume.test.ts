import { describe, it, expect } from 'vitest';
import {
  ResumeSchema,
  resumeToRawText,
  RESUME_BULLET_MAX,
  RESUME_SUMMARY_MAX,
  type Resume,
} from '@effjobhunt/shared';

// ── Test fixtures ──────────────────────────────────────────────────────────

const minimalResume: Resume = {
  contact: { name: 'Jane Doe', email: 'jane@example.com' },
  summary: undefined,
  experience: [],
  education: [],
  skills: [],
};

const fullResume: Resume = {
  contact: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
    linkedin: 'https://linkedin.com/in/janedoe',
  },
  summary: 'Experienced software engineer.',
  experience: [
    {
      company: 'Acme Corp',
      title: 'Senior Engineer',
      startDate: 'Jan 2020',
      endDate: 'Dec 2023',
      bullets: [
        'Led frontend migration to React.',
        'Reduced bundle size by 40%.',
      ],
    },
  ],
  education: [
    {
      institution: 'MIT',
      degree: 'B.S.',
      field: 'Computer Science',
      graduationYear: 2019,
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js'],
};

// ── ResumeSchema ───────────────────────────────────────────────────────────

describe('ResumeSchema', () => {
  it('accepts a minimal valid resume', () => {
    expect(ResumeSchema.safeParse(minimalResume).success).toBe(true);
  });

  it('accepts a fully populated resume', () => {
    expect(ResumeSchema.safeParse(fullResume).success).toBe(true);
  });

  it('rejects a resume with an empty name', () => {
    const bad = { ...minimalResume, contact: { name: '', email: 'a@b.com' } };
    expect(ResumeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const bad = { ...minimalResume, contact: { name: 'Jane', email: 'not-an-email' } };
    expect(ResumeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a bullet over RESUME_BULLET_MAX characters', () => {
    const longBullet = 'x'.repeat(RESUME_BULLET_MAX + 1);
    const bad: Resume = {
      ...minimalResume,
      experience: [
        { company: 'Corp', title: 'Dev', startDate: '2020', bullets: [longBullet] },
      ],
    };
    expect(ResumeSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a bullet exactly at RESUME_BULLET_MAX characters', () => {
    const exactBullet = 'x'.repeat(RESUME_BULLET_MAX);
    const good: Resume = {
      ...minimalResume,
      experience: [
        { company: 'Corp', title: 'Dev', startDate: '2020', bullets: [exactBullet] },
      ],
    };
    expect(ResumeSchema.safeParse(good).success).toBe(true);
  });

  it('rejects a summary over RESUME_SUMMARY_MAX characters', () => {
    const bad = { ...minimalResume, summary: 'y'.repeat(RESUME_SUMMARY_MAX + 1) };
    expect(ResumeSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a summary exactly at RESUME_SUMMARY_MAX characters', () => {
    const good = { ...minimalResume, summary: 'y'.repeat(RESUME_SUMMARY_MAX) };
    expect(ResumeSchema.safeParse(good).success).toBe(true);
  });

  it('rejects an invalid LinkedIn URL', () => {
    const bad = {
      ...minimalResume,
      contact: { name: 'Jane', email: 'jane@example.com', linkedin: 'not-a-url' },
    };
    expect(ResumeSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an empty linkedin string (cleared field)', () => {
    const good = {
      ...minimalResume,
      contact: { name: 'Jane', email: 'jane@example.com', linkedin: '' },
    };
    expect(ResumeSchema.safeParse(good).success).toBe(true);
  });

  it('accepts a valid linkedin URL', () => {
    const good = {
      ...minimalResume,
      contact: {
        name: 'Jane',
        email: 'jane@example.com',
        linkedin: 'https://linkedin.com/in/janedoe',
      },
    };
    expect(ResumeSchema.safeParse(good).success).toBe(true);
  });
});

// ── resumeToRawText ────────────────────────────────────────────────────────

describe('resumeToRawText', () => {
  it('includes contact name and email', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
  });

  it('includes optional contact fields when present', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('San Francisco, CA');
    expect(text).toContain('https://linkedin.com/in/janedoe');
    expect(text).toContain('555-1234');
  });

  it('includes summary', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('Experienced software engineer.');
  });

  it('includes job company, title and bullets', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Led frontend migration to React.');
    expect(text).toContain('Reduced bundle size by 40%.');
  });

  it('includes education fields', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('MIT');
    expect(text).toContain('Computer Science');
    expect(text).toContain('2019');
  });

  it('includes skills', () => {
    const text = resumeToRawText(fullResume);
    expect(text).toContain('TypeScript');
    expect(text).toContain('React');
    expect(text).toContain('Node.js');
  });

  it('returns a non-empty string for a minimal resume', () => {
    const text = resumeToRawText(minimalResume);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('Jane Doe');
  });

  it('produces no blank lines in output', () => {
    const text = resumeToRawText(minimalResume);
    const blankLines = text.split('\n').filter((l) => l.trim() === '');
    expect(blankLines.length).toBe(0);
  });

  it('is deterministic — same input produces same output', () => {
    expect(resumeToRawText(fullResume)).toBe(resumeToRawText(fullResume));
  });
});
