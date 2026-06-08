# ADR 0003: Remove resume upload slots and AiModal in favour of inline CV flow

## Status
Accepted

## Context
The original AI-assist flow required users to upload resume PDFs into one of three named slots (A, B, C) before the AI could reference their experience. Generating a cover letter or outreach draft meant opening a separate AiModal panel, selecting which slot(s) to include, and then triggering generation.

This created significant friction during active job applications: users had to leave the job row, manage file uploads, and navigate a separate UI surface before getting any AI output.

In parallel, an inner-row CV creation flow was introduced — users build and curate their CV directly inside the job detail view with far fewer steps. This surface proved to be lower-friction and better contextualised (the job description is already present).

## Decision
Remove the resume slot system (`resume_slots` table, `resumes` storage bucket, `resumeService`, `resumeTextService`) and the standalone `AiModal` component entirely. The `resumes` storage bucket is deleted via the Supabase dashboard; the table is dropped via migration `20260607000000_drop_resume_slots`.

AI flows that previously relied on extracted PDF text (outreach drafting in `ContactList`) are stubbed to return empty resume context for now, pending a future wire-up to the master CV / curated resume system.

## Consequences
- Removes upload management overhead and the three-slot Pro gate.
- AI outreach drafts in the Network page temporarily have no resume context until the master CV integration is completed.
- Pricing and tutorial copy updated to remove resume slot references.
- Simplifies the codebase: two service files, one large modal component, and associated test mocks deleted.
