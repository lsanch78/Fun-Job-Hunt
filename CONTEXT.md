# EffJobHunt

An automated job application system that scrapes job postings, tailors resumes, fills forms, submits applications, and tracks everything — while keeping the user in control via a review queue.

## Language

**Job posting**:
A single job listing scraped from a supported source (LinkedIn, Handshake). Contains title, company, description, requirements, and application URL.
_Avoid_: listing, opportunity, role (use only in UI copy)

**Review queue**:
The stream of incoming **Job postings** presented to the user for accept/reject decisions. The primary human touchpoint in the pipeline.

**Accept**:
The user's decision to allow the pipeline to proceed for a given **Job posting**. Triggers the full application pipeline by default.
_Avoid_: approve (reserved for the submission gate)

**Reject**:
The user's decision to discard a **Job posting** from the **Review queue**. No further action is taken.

**Application pipeline**:
The automated sequence that runs after a user **Accepts** a job: resume tailoring → form filling → submission.

**Request review**:
A flag a user can set on an **Accepted** job to pause the **Application pipeline** before submission and require explicit human approval of the tailored resume and filled form.

**Submission gate**:
The manual approval step triggered by **Request review**. The user sees the tailored resume and pre-filled form before the application is submitted.

**Application record**:
The persisted state of a single job application — its source, status, tailored resume snapshot, form answers used, and outcome. Written to the tracking spreadsheet.

**Application log**:
The web UI view that displays all **Application records** with filtering, sorting, and outcome tracking. The user's persistent view of the full job search. Backed by Supabase. Replaces the need for a spreadsheet.
_Avoid_: tracking spreadsheet, Excel sheet

**Form answer map**:
A user-maintained key→value store of standard answers (name, address, work authorization, etc.) used to pre-fill application forms.

**Human randomness layer**:
Timing jitter and behavioral variation injected into browser automation to avoid bot detection patterns.

**Telegram notifier**:
A Telegram bot that pushes new **Job postings** to the user with inline accept/reject/request-review buttons. The primary mobile interaction surface for the **Review queue**.
_Avoid_: push notification, alert, SMS

**Configurable threshold**:
A user-defined setting that controls the balance between application volume and match precision (e.g. minimum match score before a job enters the **Review queue**).

**Match score**:
A number from 0–100 representing keyword overlap between a **Job posting**'s description and the user's resume. Computed locally with no external API calls. Drives the **Configurable threshold** and powers keyword highlighting in the **Review queue**.
_Avoid_: relevance score, similarity score, AI score

## Relationships

- A **Review queue** surfaces many **Job postings**
- A **Job posting** is either **Accepted** or **Rejected**
- An **Accepted** job posting enters the **Application pipeline**
- An **Application pipeline** run may be paused by a **Request review** flag, creating a **Submission gate**
- Every completed **Application pipeline** run produces one **Application record**
- All **Application records** are surfaced in the **Application log**
- The **Application pipeline** uses the **Form answer map** to fill forms
- The **Human randomness layer** wraps all browser automation actions
- The **Telegram notifier** is the primary mobile touchpoint for the **Review queue**
- A **Job posting** carries one **Match score** computed against the user's resume at scrape time

## Flagged ambiguities

- None yet
