# ADR 0003: PDF resume size limit set at 1 MB, enforced at two layers

## Status
Accepted

## Context
Users can upload up to 3 resume PDFs (slots a, b, c). Without a size limit, a single user uploading scanned or image-heavy PDFs could consume 10–20 MB of Supabase Storage per user. At modest scale this exhausts the free tier storage budget.

A legitimate resume PDF — including graphically designed ones with embedded fonts and photos — rarely exceeds 1.5 MB. A 10-page resume is typically 500 KB–1 MB. Files larger than 1 MB are almost always scanned documents, wrong files, or image dumps.

The 3-slot design means maximum exposure per user is 3 × 1 MB = 3 MB, which is predictable and bounded.

## Decision
Maximum PDF size is 1 MB per file. Enforced at two layers:

1. **Frontend** — size check in `resumeService.ts` before the upload call. Returns an error if `file.size > 1 * 1024 * 1024`.
2. **Supabase Storage bucket policy** — `resumes` bucket max file size set to 1 MB in the Supabase dashboard. This layer cannot be bypassed by direct API calls.

## Consequences
- Storage exposure per user is bounded at 3 MB for resumes regardless of upload attempts.
- Legitimate users are unlikely to be affected. Graphically designed resumes that exceed 1 MB should be exported at lower resolution before uploading.
- The bucket policy lives outside the codebase. This ADR is the only record of why the limit exists and where it is configured.
- If the limit needs to change in the future, both the frontend check in `resumeService.ts` and the Supabase dashboard bucket policy must be updated together.
