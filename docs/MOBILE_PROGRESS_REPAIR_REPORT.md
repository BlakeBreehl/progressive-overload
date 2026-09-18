# Mobile, Progress, and startup repair — September 17, 2026

This is a local repair and migration-review candidate, **not deployment approval**. The working tree was clean at starting commit `d5583fe`. Existing completed release work was retained. No push, deployment, SQL execution, live-account mutation, or new migration occurred. No service-role key was introduced.

The reported real-iPhone collapse and recurring authenticated startup failure were **not reproduced with a live account**. Their exact production causes remain unconfirmed. The changes and synthetic tests below do not remove those release gates.

1. **Progress width and collapse**

   Fixed concrete sizing weaknesses: grid/flex children and chart/card parents now have shrinkable minimum widths; Recharts containers explicitly accept `minWidth={0}`; Progress tabs wrap; long headings and values wrap; wide tables retain their own keyboard-focusable, labeled horizontal scrollers. No global horizontal clipping was added as a substitute for fixing children.

   The portaled Select/Combobox/MultiSelect positioning function previously used an unbounded `Math.max(trigger.width, 220)` and retained its opening coordinates after resizing. It now clamps the actual width and position to the visual viewport and recalculates on window/visual-viewport resize and scroll. Tests cover oversized anchors, narrow phones, keyboard-sized viewports, and rotation.

   The original build also passed the synthetic portrait cases. A suspected baseline rotation failure was traced to the test fixture's unwrapped result output, not application content; that output is now hidden. **There is no honest basis to name a confirmed element responsible for the user's original iPhone collapse.** The listed changes address concrete sizing risks, but authenticated reproduction on the affected device/data remains required.

2. **iOS input zoom**

   Editable inputs, textareas, editable content and keyboard comboboxes receive a computed `16px` font under `@supports (-webkit-touch-callout:none)`, coarse-pointer/no-hover layouts, and widths at most 899px. Read-only Group Code display keeps its larger typography. This covers authentication/passwords, Strength, Cardio, Flexibility, Bodyweight, history/Progress search, locations, activity/exercise management, Groups and Settings through their shared controls.

   Android and desktop do not meet that combined condition; their input typography remains unchanged. Pinch zoom and the existing `viewport-fit=cover` meta tag remain enabled. Buttons use `touch-action:manipulation`; there is no broad `touch-action:none`. Dialogs track `visualViewport.height/offsetTop` while open so the keyboard does not leave them centered behind the obscured area. Searchable comboboxes have `autocomplete=off` and `enterkeyhint=search`; existing password/email autocomplete and numeric keyboard types are retained.

   Windows WebKit does not expose the iOS `touch-callout` capability even with an iPhone user agent. Its layout checks therefore **do not prove the iOS font branch or absence of native keyboard zoom**. Those require a real iPhone.

3. **Startup “We hit a snag”**

   Source tracing locates this exact heading exclusively in App's required account-bootstrap error branch. The operations are the `.single()` reads of `user_settings` (module flags and preferred unit) and `profiles` (onboarding completion), after auth restoration/server-user validation. There is no captured live error identifying which read/code caused the reported failures.

   Repairs: in-flight setup is deduplicated by client/account; subscriber disposal suppresses old-account results; account-scoped state clears on sign-out and modules remain gated on the matching loaded user. Auth listeners still register before `getSession`, stale session results cannot overwrite events, repeated same-user validation events share the pending validation, and token refresh preserves an already-ready account.

   Bootstrap errors preserve safe operation/status information. Transient classification covers network failures, Safari's `Load failed`, unavailable/gateway HTTP statuses and bounded companion-row readiness retries. Schema, permission and relationship errors are classified before transient conditions and are not automatically retried as network failures. Retries remain bounded with backoff. Retry works without refresh; recoverable failures subscribe to online/visibility restoration and unsubscribe on disposal. Groups/privacy RPCs are not part of required account readiness.

   React caches a rejected lazy import. Feature-boundary Retry now resets only failed lazy loaders before remounting, rather than reusing a rejected promise. A real-browser fixture rejects the first import and verifies a successful second attempt without navigation or refresh. Existing stale-chunk one-reload recovery is now scoped to the main bundle version. The service worker continues to bypass auth/API/Supabase/non-GET traffic, refuses to cache HTML masquerading as an asset, and removes only older application caches.

   Development diagnostics emit feature, operation, bounded code, numeric status, and a fixed error classification. Raw messages, details, hints, headers, tokens, codes, emails and records are not logged. Bodyweight's raw error logger was removed.

   **The actual recurring authenticated startup failure is still a deployment blocker pending safe live diagnostics and reproduction.** A missing companion row hidden by RLS may present as zero rows; bounded retries must not be mistaken for a database repair.

4. **Cardio distance**

   Existing SQL already normalizes compatible stored distances into meter aggregates. The shared `distanceUnits.ts` utility converts those aggregates to miles before client-side totals/ranking: one mile is exactly 1609.344 meters. Miles, kilometers, meters, yards and feet use shared factors; invalid, negative, missing and incompatible measurements are excluded from distance evidence. Members without compatible distance remain unranked rather than receiving a fabricated zero. Both displayed leaderboard totals use the same `displayMiles` formatter and `mi` label, rounding only at display to three decimal places. Stored entries and SQL are unchanged. Progress reuses the same conversion utility; chronological ordering does not depend on conversion.

5. **Bodyweight copy/dates**

   Removed both long visible calculation notes. Retained a concise accessible table caption, units, column labels, per-row measured-day counts, empty states and Partial badges. Week labels explicitly format the local Monday as `Week of Sep 7, 2026`. Missing changes use an explicit Unicode escape for an em dash rather than `?`. Monday buckets, daily weighting, stored dates and adjacent-week comparisons are unchanged. A Unicode/mojibake source scan found no remaining encoded corruption in active TS/TSX/CSS. Also corrected password reset's `Requesting link?` loading copy.

6. **Strength X-axis ticks**

   The shared axis now uses the actual Recharts width instead of `window.innerWidth`. It requests at most four labels up to 480px, six up to 900px, and eight above that. Short spans use month/day, longer spans month/year, multi-year spans years; explicit yearly aggregation uses years. Duplicate formatted labels are removed. Recharts additionally enforces an 18px minimum gap with endpoint preservation. Actual data and All Logged Sets markers are retained; full dates remain in tooltips. Browser checks cover all three modes, expanded/custom controls, and physical tick-label overlap.

7. **Chronological chart series**

   Cardio filters before sorting numerically by performed timestamp, then creation timestamp, then ID. Date-only values parse as local midnight, not UTC. Creation time is now selected from Supabase. All Cardio metrics share that ordered series; tooltip payloads preserve each entry's details and performed time. September 3-created-first/September 1-created-later is covered in unit and browser fixtures. Flexibility also sorts raw entries by performed evidence before its filtered series. Strength already sorted by performance/creation/set order/ID; its date-only comparison now uses the same local timestamp helper. Bodyweight already sorts by measured timestamp then ID.

8. **Sets by Muscle Group**

   Added a private Strength Progress chart between the selected-exercise graph and the exercise tables. Monthly is default; Weekly uses local Monday–Sunday buckets and Yearly uses calendar years. Date and location filters apply before counting. Each distinct saved set counts once toward the primary muscle group through the exact `countSetGroups` function used by Your Sets, including reps-only and distance/laps sets. Compound/multi-group exercises do not count twice. Unknown classifications use Olympic/Other.

   Your Sets and the trend import the same exported palette and ordered categories. Interior missing buckets are explicit zero; nothing is fabricated before the first or after the last measured bucket after filtering. Rows are chronological; current buckets expose Partial in tooltips. Tooltips include exact total and per-visible-group counts. Lines have small markers, whole-number Y ticks starting at zero, and accessible pressed-state legend buttons. Row updates naturally move edited sets and remove deleted sets when fresh rows load. This chart adds no Groups query or sharing path.

9. **Group Code permissions/placement**

   The short-code card renders only inside an open Manage Group section, and is removed from the DOM when closed. Existing owner-only permission remains authoritative; the model has owner/member roles, not a separate manager role. Regular members get neither the management section nor code card. Opening/closing does not fetch or regenerate a code. Current code, Copy, Share and confirmed Replace remain; Join a Group remains prominent. Automatic creation, account-scoped clearing, privacy toggle and migration 010's server enforcement are preserved. There is no long-token UI and no obsolete Generate Code/Disable Joining control.

10. **Files changed**

    The complete file inventory is appended below. Production changes are concentrated in App/auth/setup and retry helpers, responsive controls/CSS, Progress/date/distance utilities, the new muscle trend, Groups placement, Bodyweight copy and the service worker. No package dependency or lockfile change was needed; optional Playwright/WebKit tooling was installed only in temporary directories.

11. **Validation and prior-release audit**

    Full Vitest suite: **396 tests across 75 files passed** (54 more tests than the starting 342). Lint: zero warnings/errors. TypeScript: passed. Production build: passed. `git diff --check`: passed. `npm audit --json`: zero vulnerabilities among 188 audited dependencies. Tracked credential-pattern scan: zero matches; only `.env.example` is tracked.

    Browser totals: **57 cases, 21,309 fixture assertions, zero failures**, plus ten successful WebKit rotation checks. Local browser evidence is stored in [mobile-progress-browser-results.json](mobile-progress-browser-results.json). The Progress fixture covers all eight requested phone dimensions, 667×375 landscape, all tabs, controls/dropdowns, chart width/height, Cardio metric ordering, Strength tick overlap, trend aggregation/legend, and failed-import Retry. Chromium runs include Android browser/standalone and iPhone-user-agent browser/standalone profiles; display-mode overrides are not installed PWAs. Additional Chromium tablet/desktop and Windows WebKit runs cover responsive charts and rotation. The separate focused fixture covers Group Code typing/permissions/privacy, all-set valley markers and navigation across all module combinations, enlarged text and representative safe areas. Fixture traffic is local and contains only synthetic data.

    Existing passing coverage retains monotonic One Rep Max/Rep Weight, valley markers, exercise table sorting, numeric integrity, server history pagination/search, stable Group Name typing, code creation/privacy, password reset/change state, Bodyweight summaries, duration wheels, mixed units, one-time 2.0 announcement, module visibility and Home-accessible Settings. Source audit found no active native select/alert/confirm/prompt or floating Add control. Bottom navigation retains Home/Strength/Progress/Leaderboards/More as applicable, safe areas, and no Settings item. These findings do not certify live email delivery, authentication, RLS or installation/update behavior.

12. **Migrations 001–009**

    All remain unchanged against the starting clean HEAD. Migration 009 is treated as already applied, per the user's instruction. None was edited, executed or rerun.

13. **Migration 010**

    `202609150010_short_group_codes_and_progress_privacy.sql` already existed at the start and remains unchanged and unapplied by this work. Its frontend RPCs are required for short-code creation/join/replacement and privacy. Reviewed the transaction, restricted helper schema, HMAC/ciphertext storage, owner checks, creation idempotency, rate limits, membership-scoped aggregates, privacy filtering, legacy-token retirement and grants. It backfills invitation state, not personal workouts/readings or memberships. Static review/tests do not prove its live execution or RLS. It still requires review and separately authorized application unless an operator independently confirms it was already applied. Older release reports saying no 010 exists are superseded by the actual repository state and this report.

14. **Authenticated QA still required**

    On real iPhone Safari and installed PWA, reproduce Progress with the affected account/data at initial scale, rotate with open controls/tooltips, focus every active form, open/close the keyboard and dialogs, pinch zoom, background/resume, and measure document width. Repeat Chrome/installed-PWA navigation and controls on a real Android device. Desktop regression should use real dense and long-named datasets too.

    For startup, record only safe feature/operation/code/status from a failing launch; exercise cold start, offline→online, slow/unavailable service, token refresh, deleted/recreated accounts, sign-out and account switching during bootstrap. Confirm Retry and visibility recovery without a reload. Exercise stale installed service worker/main/chunk combinations and update recovery using a deployment-like test environment.

    After database prerequisites are confirmed, use owner/member/nonmember accounts to verify code visibility, automatic code creation, copy/share/replacement, failed joins/rate limits, membership removal, privacy opt-out and server-side aggregate exclusion. Test password reset delivery, expired/used links, recovery without a session, current-password change and optional reauthentication. No real reset email or live mutation was initiated here.

15. **Remaining deployment blockers**

    Migration 010 prerequisite is unconfirmed/unapplied; the original recurring startup failure lacks a captured live operation/code and demonstrated fix; the original real-device Progress collapse lacks a confirmed reproduction/root cause; authenticated device/PWA/password/multi-account/RLS QA remains outstanding. There are no known failing automated checks, but that does not resolve these gates.

File inventory:

- [docs/MOBILE_PROGRESS_REPAIR_REPORT.md](../docs/MOBILE_PROGRESS_REPAIR_REPORT.md)
- [docs/mobile-progress-browser-results.json](../docs/mobile-progress-browser-results.json)
- [public/sw.js](../public/sw.js)
- [src/App.tsx](../src/App.tsx)
- [src/components/ConfirmDialog.tsx](../src/components/ConfirmDialog.tsx)
- [src/components/FeatureBoundary.tsx](../src/components/FeatureBoundary.tsx)
- [src/components/PasswordManagement.tsx](../src/components/PasswordManagement.tsx)
- [src/components/SelectionControls.tsx](../src/components/SelectionControls.tsx)
- [src/components/TimeXAxis.test.ts](../src/components/TimeXAxis.test.ts)
- [src/components/TimeXAxis.tsx](../src/components/TimeXAxis.tsx)
- [src/components/menuPosition.test.ts](../src/components/menuPosition.test.ts)
- [src/components/menuPosition.ts](../src/components/menuPosition.ts)
- [src/features/groups/GroupsFeature.tsx](../src/features/groups/GroupsFeature.tsx)
- [src/features/groups/groupCode.test.ts](../src/features/groups/groupCode.test.ts)
- [src/features/groups/logic.test.ts](../src/features/groups/logic.test.ts)
- [src/features/groups/logic.ts](../src/features/groups/logic.ts)
- [src/features/progress/ProgressFeature.tsx](../src/features/progress/ProgressFeature.tsx)
- [src/features/progress/logic.ts](../src/features/progress/logic.ts)
- [src/features/progress/repository.ts](../src/features/progress/repository.ts)
- [src/features/progress/strengthModes.ts](../src/features/progress/strengthModes.ts)
- [src/features/strength/SetsByMuscleGroup.tsx](../src/features/strength/SetsByMuscleGroup.tsx)
- [src/features/strength/YourSets.tsx](../src/features/strength/YourSets.tsx)
- [src/features/strength/setBreakdown.ts](../src/features/strength/setBreakdown.ts)
- [src/features/strength/setTrend.test.ts](../src/features/strength/setTrend.test.ts)
- [src/features/strength/setTrend.ts](../src/features/strength/setTrend.ts)
- [src/features/weight/WeeklyChangeTable.tsx](../src/features/weight/WeeklyChangeTable.tsx)
- [src/features/weight/WeightFeature.tsx](../src/features/weight/WeightFeature.tsx)
- [src/features/weight/weeklySummary.test.ts](../src/features/weight/weeklySummary.test.ts)
- [src/features/weight/weeklySummary.ts](../src/features/weight/weeklySummary.ts)
- [src/index.css](../src/index.css)
- [src/lib/AuthProvider.tsx](../src/lib/AuthProvider.tsx)
- [src/lib/accountBootstrap.test.ts](../src/lib/accountBootstrap.test.ts)
- [src/lib/accountBootstrap.ts](../src/lib/accountBootstrap.ts)
- [src/lib/connectionRecovery.test.ts](../src/lib/connectionRecovery.test.ts)
- [src/lib/connectionRecovery.ts](../src/lib/connectionRecovery.ts)
- [src/lib/distanceUnits.test.ts](../src/lib/distanceUnits.test.ts)
- [src/lib/distanceUnits.ts](../src/lib/distanceUnits.ts)
- [src/lib/keyboardViewport.ts](../src/lib/keyboardViewport.ts)
- [src/lib/performedOrder.test.ts](../src/lib/performedOrder.test.ts)
- [src/lib/performedOrder.ts](../src/lib/performedOrder.ts)
- [src/lib/retryableLazy.tsx](../src/lib/retryableLazy.tsx)
- [src/lib/serviceWorker.test.ts](../src/lib/serviceWorker.test.ts)
- [src/lib/settings.ts](../src/lib/settings.ts)
- [src/lib/settingsRetry.test.ts](../src/lib/settingsRetry.test.ts)
- [src/lib/startupAuth.test.ts](../src/lib/startupAuth.test.ts)
- [src/lib/startupAuth.ts](../src/lib/startupAuth.ts)
- [src/lib/supabaseError.test.ts](../src/lib/supabaseError.test.ts)
- [src/lib/supabaseError.ts](../src/lib/supabaseError.ts)
- [src/lib/timeAxis.ts](../src/lib/timeAxis.ts)
- [src/main.tsx](../src/main.tsx)
- [tests/browser/focusedRelease.jsx](../tests/browser/focusedRelease.jsx)
- [tests/browser/mobileRepair.jsx](../tests/browser/mobileRepair.jsx)
- [tests/browser/runFocusedRelease.mjs](../tests/browser/runFocusedRelease.mjs)
- [tests/browser/runWebkitRepair.mjs](../tests/browser/runWebkitRepair.mjs)
- [tests/browser/serveFocusedRelease.mjs](../tests/browser/serveFocusedRelease.mjs)

**READY FOR MIGRATION 010 REVIEW**
