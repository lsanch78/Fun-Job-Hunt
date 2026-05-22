import { z } from 'zod';

export const RESUME_BULLET_MAX = 200;
export const RESUME_SUMMARY_MAX = 600;

export const ContactInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Must be a valid email'),
  phone: z.string().max(30).optional(),
  location: z.string().max(120).optional(),
  // Allow empty string (cleared field) OR a valid URL
  linkedin: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

export const WorkExperienceSchema = z.object({
  company: z.string().min(1, 'Company is required').max(120),
  title: z.string().min(1, 'Title is required').max(120),
  startDate: z.string().max(20),
  endDate: z.string().max(20).optional(),
  bullets: z
    .array(
      z.string().max(
        RESUME_BULLET_MAX,
        `Bullet must be ${RESUME_BULLET_MAX} characters or fewer`
      )
    )
    .max(10),
});

export const EducationSchema = z.object({
  institution: z.string().min(1, 'Institution is required').max(160),
  degree: z.string().max(80).optional(),
  field: z.string().max(120).optional(),
  graduationYear: z.number().int().min(1950).max(2040).optional(),
});

export const ResumeSchema = z.object({
  contact: ContactInfoSchema,
  summary: z.string().max(RESUME_SUMMARY_MAX).optional(),
  experience: z.array(WorkExperienceSchema).max(20),
  education: z.array(EducationSchema).max(10),
  skills: z.array(z.string().min(1).max(60)).max(60),
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;
export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Resume = z.infer<typeof ResumeSchema>;

/**
 * Concatenates all resume fields into a single string for keyword extraction.
 * Used by both the web save handler and the worker when computing match scores.
 */
export function resumeToRawText(resume: Resume): string {
  const lines: string[] = [];

  const c = resume.contact;
  lines.push(c.name, c.email);
  if (c.phone) lines.push(c.phone);
  if (c.location) lines.push(c.location);
  if (c.linkedin) lines.push(c.linkedin);

  if (resume.summary) lines.push(resume.summary);

  for (const job of resume.experience) {
    lines.push(job.company, job.title);
    if (job.startDate) lines.push(job.startDate);
    if (job.endDate) lines.push(job.endDate);
    lines.push(...job.bullets);
  }

  for (const edu of resume.education) {
    lines.push(edu.institution);
    if (edu.degree) lines.push(edu.degree);
    if (edu.field) lines.push(edu.field);
    if (edu.graduationYear != null) lines.push(String(edu.graduationYear));
  }

  lines.push(...resume.skills);

  return lines
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join('\n');
}
