# Release-candidate audit after migration 009

Status: READY FOR AUTHENTICATED RELEASE QA, subject to the URL configuration below. Not deployment readiness. The user reports migration 009 successfully applied; this audit did not inspect or execute remote SQL. Do not apply 009 again. Migrations 001?009 are byte-for-byte unchanged against start-of-audit SHA-256 snapshots. No live data, passwords, email requests, memberships or settings were modified; no push or deployment occurred.

## Missing requirements found and implemented

Password management was absent: no Forgot Password entry, reset request, dedicated recovery route/screen, password-update form, Settings password change, expired-link UI or recovery-event branch. Implemented all using the existing Supabase browser client. Reset requests always use the same generic response, including SDK errors/network failures, rather than disclose account existence. The SDK manages callback credentials and session storage; application code retains only recovery routing flags and transient form state. It does not persist or log passwords, verification codes or recovery tokens.

Recovery is detected before client initialization at /auth/reset-password or an implicit callback with type=recovery. PASSWORD_RECOVERY routes to the dedicated screen before app setup/announcement rendering. Existing deferred server session validation remains outside the auth callback lock. Invalid/no-session callbacks offer a new link; transient validation failures offer Retry. Callback parameters are removed from the address bar after initialization/validation settles. Refreshing the clean recovery route can use a valid SDK session. Account changes remount the recovery form, clearing entered fields. A user explicitly cancelling recovery retains the SDK-authenticated session and returns to the app; cancellation does not mutate account settings.

Settings adds Current Password, New Password and confirmation, calling updateUser with current_password. Recovery calls updateUser with the new password using its authenticated recovery session. Both support Supabase email reauthentication/nonce if requested by the configured security policy. Passwords are cleared on success and unmount. Generic error UI handles rejection, weak/same passwords and expired sessions. Supabase server policy remains authoritative.

Also found and fixed a disconnected Bodyweight history search: added a clearly labeled notes search with account-scoped server filtering before pagination, reset-to-page-one on search change, and correct empty-search results. This searches notes, not converted numeric weights. Corrected the Progress PR legend's stray question mark.

## Prior-feature audit

| Requirement | Source/local-test finding |
| --- | --- |
| Mobile navigation / Leaderboards / no floating Add | Adaptive bottom navigation has at most five destinations and explicit Leaderboards; More handles secondary modules. No floating Add path. Existing navigation tests pass. |
| Locations | Management remains in Settings; shared inline LocationSelect permanently saves and selects owned locations through the existing client. |
| Historical exclusive PR classification | Lifetime evidence precedes visibility filters; First Entry, Weight and Rep classification remain exclusive. Canonical kg comparison is separate from displayed conversion. Existing PR tests pass. |
| PR colors and Progress highlighting | Rep indicators blue, Weight indicators green, First Entry neutral; table badges/highlights remain connected. Legend corrected. |
| Strength History | All Time default (days=0), debounced exercise search, deterministic server ordering and pagination remain. |
| Reps-only and mixed units | Reps-only labels avoid missing weight; actual units normalize for display and comparison. Unit/PR tests pass. |
| Bodyweight history | Notes search now connected; edit/delete/raw-unit preservation and separate server pagination retained. |
| Main Bodyweight graph | Independent continuous red/black lines, no manufactured readings, Straight/Smooth retained. |
| Weekly table / summaries | Daily means then calendar-week means, adjacent-week changes, partial label, ranges and pagination retained; rolling weekly/monthly cards retained. |
| Axes / date labels | Shared niceAxis, metric ticks and local-date TimeXAxis remain wired; existing range/calendar tests pass. |
| Strength modes | Custom selector, PR progression, actual one-rep, Rep Weight and all-set paths remain wired. No estimated 1RM. Distance tracking uses its distance view. |
| Your Sets | Current calendar-month start and multi-month calendar periods, primary-muscle counts once per set, contrasting donut categories retained. |
| Cardio timer | HH:MM:SS output and labeled Hours/Minutes/Seconds wheels retained. |
| Groups / invites / leaderboards | Private consent, owner/member controls, hashed invites and membership-scoped aggregate calls remain wired. Static SQL/security contracts pass; authenticated RLS behavior still requires live QA. |
| Announcement | Existing final release ID and dismissal persistence unchanged; updated weekly-table copy retained. Recovery gates the app before this dialog. |
| Cold start | Deferred getUser validation, transient retry, stale-generation suppression and ready-user token refresh preserved; recovery-transition tests added. |

No other obsolete feature placeholders were found that justified removal. Input placeholder text is legitimate UI, not unfinished functionality. Existing earlier uncommitted work was preserved.

## Exact Supabase Auth URL configuration

The production hostname is not present in repository configuration and has not yet been supplied. It must not be guessed. Let PROD be the exact public production origin, for example the actual HTTPS custom domain or Netlify site origin, with no trailing slash. In Supabase Dashboard ? Authentication ? URL Configuration:

- Site URL: PROD (the actual origin, not the literal word PROD).
- Redirect URLs: PROD/auth/reset-password.
- For local Vite QA: http://localhost:5173/auth/reset-password.
- If using Vite preview: http://localhost:4173/auth/reset-password.
- Add http://127.0.0.1:5173/auth/reset-password or http://127.0.0.1:4173/auth/reset-password only if that hostname is actually used.
- If an intentionally approved preview hostname is tested, allow its exact /auth/reset-password URL separately. Do not use an unrestricted production wildcard.

The client constructs redirectTo from window.location.origin plus /auth/reset-password. Therefore requests made locally return locally and requests made on production return to that same production origin. Keep Supabase's Reset Password email link pointing at {{ .ConfirmationURL }}; do not replace it with an unverified client URL or a custom token-storage flow. Confirm Email confirmation links may continue using the Site URL. Use only the existing public publishable/anon browser key, never a service-role key.

The Netlify /* ? /index.html 200 rewrite already serves the dedicated route. Manifest scope=/ supports the same route in an installed PWA. The OS may open email links in the default browser rather than the installed PWA; both use the same HTTPS callback, and each has its own SDK session storage. Password recovery requires a network connection. The service worker excludes /auth/ and Supabase requests from caching. No forced transfer of recovery credentials between browser and PWA is attempted.

Official references: [Supabase resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect allowlists](https://supabase.com/docs/guides/auth/redirect-urls). The installed SDK types also confirm current_password and nonce support.

## Files changed in this audit

- src/AuthScreen.tsx: Forgot Password entry.
- src/components/PasswordManagement.tsx: request, update and recovery screens (new).
- src/components/PasswordManagement.test.tsx: accessible forms/gates/security contracts (new).
- src/lib/passwordRecovery.ts: safe recovery metadata, redirects, request response, error/view helpers (new).
- src/lib/passwordRecovery.test.ts: routing, generic requests and auth-transition tests (new).
- src/lib/supabase.ts: capture routing flags before SDK initialization.
- src/lib/AuthProvider.tsx: recovery gate, URL cleanup and account-keyed form.
- src/lib/startupAuth.ts: recovery-event notification; auth diagnostics now omit raw error message/details.
- src/features/settings/SettingsPanel.tsx: Change Password entry/form.
- src/features/weight/WeightFeature.tsx: history notes search and empty result handling.
- src/features/weight/repository.ts: owner-scoped search before server pagination.
- src/features/weight/historySearch.test.ts: query/order/account contract (new).
- src/features/progress/ProgressFeature.tsx: legend punctuation.
- docs/RELEASE_CANDIDATE_AUTH_AUDIT.md: this audit.

## Automated validation

296 tests across 62 files passed; 11 tests added during this audit. Lint has zero warnings. TypeScript, production build and git diff --check passed. Dependency audit reports zero vulnerabilities. Searches found no native select/alert/confirm/prompt or embedded privileged-key patterns in active application source. .env, .env.local and dist remain ignored/untracked; no database/environment/dependency file changed. No test uses a real password, recovery token or live account. Browser email/SMTP/server security policies are not proven by mocked/local tests.

## Exact authenticated manual QA still required

Use two or preferably three disposable accounts in an approved QA environment. These steps intentionally change only QA-account passwords and disposable fixtures; none were executed in this audit.

1. Configure the exact URLs above once PROD is known. Verify Supabase SMTP/email delivery, email template and configured password/reauthentication policy. Open the callback path directly while signed out: it must show invalid/expired guidance without a password form.
2. From sign-in, request a reset for an existing QA account, then a nonexistent address. UI responses must be identical. Exercise offline and rate-limited requests without displaying server account-existence errors. Do not use response timing as evidence of account existence; backend behavior is governed by Supabase.
3. Open the newest valid link online in a signed-out normal browser. Confirm Set New Password appears before onboarding, Home or the announcement; check the displayed account, no raw callback data in app diagnostics, and eventual clean /auth/reset-password address. Submit mismatched/short passwords, then a valid password. Sign out and verify the new password works and the old password fails.
4. Repeat locally and on the configured HTTPS QA/production origin without changing live production records. Verify links return to the requesting origin. Repeat in the installed PWA/default browser, cold start and refresh. Never paste tokens into logs, screenshots or issue reports.
5. Test used, expired and invalid links and Request a new link. Interrupt the network during session validation, restore it and Retry without manual refresh. Test an existing signed-in browser opening a link for the other QA account: identity must change correctly and any password fields must reset on account switch.
6. In Settings, change the QA password using current/new/confirmation. Test wrong current password, mismatches, server weak/same-password rejection and valid success. If Secure Password Change requires email verification, Send verification code and submit the code. Verify expired code/session errors and retry. Confirm only the intended QA account can sign in with the new password afterward.
7. Cold launch/reopen the installed PWA with valid, expired and revoked QA sessions; test token refresh, offline startup, Retry, sign-out during pending validation and account switching. No old-account content may appear.
8. Run two-account Groups QA after the already-applied 009: create/join by explicit consent, invite rotate/revoke/expired failure, non-owner action denial, removal immediately denying subsequent aggregate RPCs, leave/delete preserving personal records, and unrelated-group/raw-note/Bodyweight isolation. Compare actual Strength/Cardio totals and deterministic ties. Use the existing GROUPS_009_REVIEW.md authenticated sequence, but do not rerun its migration application instructions.
9. At 320/375/390/430 pixels, verify every module combination, More/Leaderboards/direct routes/Back, password forms and keyboard focus. Check Settings and inline locations, Strength All Time/search/page/edit, reps-only labels, mixed-unit graphs and historical PR table colors. Verify Your Sets month boundaries and Cardio HH:MM:SS.
10. With disposable Bodyweight readings, test notes search, empty results, page reset, edit/delete, independent continuous Morning/Evening lines, Straight/Smooth, mixed units, weekly table ranges/signs/gaps and weekly/monthly cards. Verify final announcement stays dismissed, can reopen manually, respects reduced motion, and cannot interrupt recovery.

Only after these authenticated checks pass should a separate deployment decision be made. This audit neither deploys nor authorizes deployment.
