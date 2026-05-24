# ADR 0001: Auto punch-out records last-activity time, not timer-fire time

## Status
Accepted

## Context
Workdays are ended either manually (user clicks punch out) or automatically (1 hour of frontend inactivity). When auto punch-out fires, the user has already walked away. Recording the timer-fire time would overstate hours worked by up to 1 hour.

## Decision
Auto punch-out records the timestamp of the user's last detected interaction (click, navigation, form input), not the moment the idle timer fires.

## Consequences
- Hours logged are honest and representative of actual work time.
- Requires tracking `lastActivityAt` continuously in the frontend while a session is active.
- A user who is genuinely working but not interacting with the app (e.g. reading a job description in another tab) could be punched out prematurely. Accepted tradeoff for v1.
