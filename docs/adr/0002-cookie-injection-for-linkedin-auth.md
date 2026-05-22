# ADR 0002: Cookie injection over credential auth for LinkedIn

## Status
Accepted

## Context
The scraper worker runs 24/7 on a VPS and needs to be authenticated with LinkedIn to scrape job postings and submit applications. Authentication must survive long-running sessions without triggering LinkedIn's bot detection or account security challenges.

## Decision
Use cookie injection for LinkedIn authentication. The user logs in manually once in a real browser, exports the session cookies, and stores them on the VPS as an environment variable or file. The Playwright scraper loads these cookies directly into the browser context, bypassing the login flow entirely.

For Handshake, credential-based login (email + password stored in environment variables) is acceptable as Handshake is less aggressive about headless browser detection.

## Alternatives considered
- **Credential auth for LinkedIn**: Storing email + password and having Playwright log in on each session. A headless Chromium instance logging into LinkedIn daily from a static VPS IP is a strong bot signal. LinkedIn frequently triggers CAPTCHA or "verify your identity" challenges in this scenario, which would block the scraper entirely.
- **Dedicated throwaway LinkedIn account**: Avoids risking the user's real professional presence. Rejected because a fresh account with no connections or history is itself a strong bot signal and gets flagged faster.

## Consequences
- LinkedIn session cookies expire approximately every 30 days and must be manually refreshed by the user.
- The system should detect cookie expiry (HTTP 401 or redirect to login page) and notify the user via Telegram to refresh cookies.
- Cookie files on the VPS must be treated as secrets — equivalent to passwords — and excluded from version control.
- This approach is harder to fully automate but meaningfully reduces account ban risk compared to credential auth.
