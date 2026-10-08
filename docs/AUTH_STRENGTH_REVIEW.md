# Strength and authentication review � 2026-10-08

Status: BLOCKED pending production URL identification and read-only live diagnosis/authenticated QA. Local implementation and automated checks are complete. No SQL, account changes, push, or deployment were performed.

## Confirmed findings and limits

- Your Sets had only 1/3/6/12-month options and selected-date queries. It had no PR counts. The replacement pages through all account-owned Strength sets in batches of 500, calculates the existing chronological PR rules against the full dataset, then selects achievements by performed date. All Time includes every dated completed set, even future-dated records. Zero-rep attempts and First Entry do not contribute PR counts; weight and rep badges remain exclusive. Derived results are never written.
- App's signed-out branch queued a state reset without an effect-lifetime guard. It could run after cleanup during an identity transition. That queued reset now checks its lifetime. Existing auth subscription ordering, auth-event precedence over getSession, deferred server validation, account identity guards, Strict Mode request sharing, transient retries and route readiness gates are retained.
- There was no app-controlled email-confirmation callback state, error handling, explicit signup redirect, or verification resend action. The SDK previously handled URL sessions implicitly. The app now owns callback processing, preventing competing SDK automatic processing, and shares the single-use code exchange across Strict Mode remounts. Both PKCE codes and legacy hash tokens are supported, including recovery callbacks. Callback credentials are cleared from the URL after processing; errors cannot fall through to an unrelated stored account session. Finishing the callback clears startup errors and starts fresh account validation. The confirmation screen provides loading/success/error states, continuation, Return to Sign In, and generic resend responses. Returning to sign in clears the local session.
- PKCE codes require the originating browser's stored verifier. Missing verifier errors explain this without bypassing confirmation. Expired and reused links can produce the same Supabase error, so the message honestly covers both. An explicit already-confirmed error has a separate message.
- Signup companion and library triggers execute inside the auth.users INSERT transaction. Persistent missing rows are not ordinary asynchronous trigger lag. Core startup reads already use maybeSingle, retry only absent-row/network/bootstrap errors, and stop on RLS/schema/cardinality errors. Four setup attempts wait 150/300/600 ms between requests; every paired query has a 15-second deadline. Auth validation/session restore have three attempts, waiting 250/500 ms, with 15-second request deadlines. Requests that finish after cleanup cannot publish; ready-account token refresh does not reload setup. Online/visibility recovery permits fresh bounded attempts.
- Existing service worker bypasses /auth/, all query-bearing URLs, Supabase and API requests. Dedicated confirmation/recovery routes therefore bypass cache; Netlify additionally sends Cache-Control: no-store for /auth/*. Legacy root hash tokens are invisible to service-worker fetch events; that response is the static app shell, never token/account content. Legacy query callbacks bypass interception. Tests cover explicit callback routes and root code/error callbacks.
- The reported production �We hit a snag� originates in failed required profile/settings bootstrap. No live failing response/code or operator-accessible account audit was supplied. Its precise production cause (missing rows, RLS, schema, transport, stale deployment) is NOT confirmed by source inspection. Do not describe the queued-reset defect as proof of that user's failure.

## Companion audit and migration

Run docs/account-companion-audit.sql manually using an operator's read-only workflow. It identifies missing profile/settings rows and empty Strength/cardio/mobility libraries. Empty libraries alone do not prove corruption: users may intentionally remove entries. No live audit was performed in this session.

A forward-only, idempotent candidate migration was added: supabase/migrations/202610080014_missing_account_companions.sql. Apply only after review and confirmation that companions are missing. It inserts missing profiles/settings with ON CONFLICT DO NOTHING, preserving existing rows, RLS, grants and triggers. It does not change auth users, reseed libraries, reset onboarding, update user entries, or persist PR badges. No prior migration was edited. Whether production needs this migration remains unverified; it was not applied or database-executed here.

## Exact Supabase Authentication URL settings

The final Netlify hostname is absent from repository configuration (netlify.toml contains build/SPA routing only; no .netlify site configuration). Do not substitute an invented hostname. Let P be the actual final HTTPS production origin with no path or trailing slash. Production Site URL must be exactly P. This is a required unresolved value, not an example host to copy.

Redirect URLs to allow, with local servers explicitly started on these ports:

| Environment | Root / legacy return | Email confirmation | Password recovery |
| --- | --- | --- | --- |
| Local dev (`npm run dev -- --port 5173 --strictPort`) | `http://localhost:5173/` | `http://localhost:5173/auth/confirm` | `http://localhost:5173/auth/reset-password` |
| Local preview (`npm run preview -- --port 4173 --strictPort`) | `http://localhost:4173/` | `http://localhost:4173/auth/confirm` | `http://localhost:4173/auth/reset-password` |
| Final Netlify production | `P/` | `P/auth/confirm` | `P/auth/reset-password` |

For a separate development Supabase project, set Site URL to `http://localhost:5173`. For the production Supabase project, keep Site URL at P even while testing local allowed redirects. If using 127.0.0.1 instead of localhost, add the same three exact URLs for that host explicitly. Ports cannot silently drift. No unrestricted production wildcard is needed.

Keep email confirmation enabled. Standard Confirm signup and Reset Password email templates should use Supabase's `{{ .ConfirmationURL }}` verification link, preserving the allowlisted redirect supplied by the app. Do not replace this with a bare SiteURL link or an app token_hash route unsupported by this implementation. Signup and resend request `/auth/confirm` on the current origin; password reset requests `/auth/reset-password`. The app never guesses a production hostname or sends users to a different origin. PKCE confirmation must open in the requesting browser. The project currently retains its default implicit flow for existing signup behavior and also accepts PKCE-returned codes.

References: https://supabase.com/docs/guides/auth/redirect-urls and https://supabase.com/docs/guides/auth/sessions/pkce-flow.

## Manual authenticated QA

Use authorized disposable QA accounts; do not delete/recreate the affected user. Configure the exact URLs above before testing. Never paste callback tokens into logs or screenshots.

1. New unconfirmed account: Create an account with email confirmation enabled. Expect check-email feedback, no app access, and no need to refresh. Attempt password login before confirmation; expect confirmation guidance. An operator can run the read-only companion audit and check auth logs; do not edit live data during diagnosis.
2. Confirmation: Open the newest email in the signup browser. Expect a loading screen, success, then Continue to app. Expect setup/onboarding after server-user validation and matching profile/settings reads, without refresh. Inspect that callback credentials disappear from the URL. Test both a PKCE `?code=` flow with its verifier and the project's legacy hash-token flow. Open a PKCE link without its verifier in another browser and expect useful guidance.
3. Returning login: Sign out, then log in to a confirmed account. Expect pending readiness followed by the app, never an immediate bootstrap error. Throttle network; observe bounded transient retries. Genuine RLS/schema failures must remain visible with their appropriate message. Record only operation/code/status for an actual failure.
4. Refresh: Refresh a signed-in protected route. Expect validated session and account setup before the feature renders. Test token refresh and installed PWA reload; no setup unmount should occur for a ready same-account token refresh.
5. Expired/reused/malformed link: Open an expired link, reopen a used link, and open `/auth/confirm` without credentials. Expect clear messages, no silent acceptance of a previous login, Return to Sign In and resend. If the email was already confirmed, return to password sign-in. No redirect loop should occur.
6. Resend: Enter an email and choose Resend verification email from sign-in or the callback screen. Existing, unknown, throttled and network-failing requests must show the same generic response. Open the newest valid email and finish confirmation without a manual refresh.
7. Password recovery: From Forgot Password, request a reset for a confirmed QA account. Open the newest link; expect callback processing then Set New Password. Change password, continue and log in with the new password. Repeat with expired and malformed recovery links and confirm no normal-app route bypass. Check the recovery redirect remains on the requested allowed origin.
8. Account switching: Delay account A's profile/settings requests; sign out and log into B before A resolves. Only B's data/settings can publish. Repeat with token refresh, sign-out during server validation, sign-out during bootstrap, and Strict Mode development remounts. Switch back to A and verify isolation and no refresh requirement.
9. Strength: Seed only authorized QA data through normal UI with older baseline entries, normal/assisted/reps-only improvements, ties, First Entry and zero-rep attempts. Compare wheel totals and exclusive PR counts for all five periods. Include over 500 sets and entries outside the visible History page. Check at 320/375/390/430-pixel widths and with an installed PWA.

## Files changed

- src/features/strength/{YourSets.tsx,setBreakdown.ts,setPeriod.test.ts}: All Time, full-dataset wheel/PR counts and tests.
- src/lib/{emailConfirmation.ts,emailConfirmation.test.ts,supabase.ts,AuthProvider.tsx}: callback detection/exchange, SDK ownership, readiness reset and tests.
- src/components/ConfirmationScreen.tsx and src/AuthScreen.tsx: callback states, signup redirect and generic resend actions.
- src/App.tsx: queued account reset lifetime guard.
- src/lib/supabaseError.ts: production startup diagnostics expose sanitized operation/code/status/classification only, permitting live diagnosis without logging tokens, emails, raw errors or user entries.
- src/lib/{startupAuth.test.ts,accountBootstrap.test.ts,serviceWorker.test.ts}: synchronous subscription, deferred missing-row race and callback-cache tests.
- netlify.toml: no-store auth response headers.
- package-lock.json: source-map-js 1.2.1 ? 1.2.2 compatible vulnerability patch.
- tests/browser/{serveYourSets.mjs,yourSets.jsx}: isolated mobile wheel/timeframe fixture.
- docs/account-companion-audit.sql, this review and migration 014: operator diagnosis, review and manual QA.

Pre-existing deleted scratch-result files were left untouched.

## Validation and remaining blockers

Full suite: 585 tests across 96 files pass, including deterministic callback and startup race tests. Lint with --deny-warnings: zero warnings/errors. TypeScript and production build pass. git diff --check passes (Git emits line-ending normalization notices only). Final npm audit: zero vulnerabilities after the source-map-js patch. Populated wheel and All Time interaction pass Chromium viewport checks at 320/375/390/430 pixels without horizontal overflow. Browser evidence is Chromium mobile viewport emulation, not real iOS Safari/device QA. No live Supabase account inventory, failing startup trace, email delivery, production hostname/configuration, or migration execution was available. These are the outstanding release blockers; local successful tests cannot establish production resolution.
