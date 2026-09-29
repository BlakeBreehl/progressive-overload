# Progressive Overload 2.2 implementation review

This is a local implementation review, not deployment approval. Migration 012 is required and has **not** been applied. Live authenticated and physical-device QA remain manual gates. No SQL was executed and no Supabase connection was made during this continuation.

## Before / after audit

“Complete” below means implemented and locally verified; it does not imply live database or device verification.

| Requirement | Before continuation | After | Evidence / boundary |
|---|---|---|---|
| 1. One exercise per new Strength entry | Complete | Complete | `WorkoutForm` exposes additional exercise blocks only for historical multi-exercise edits. Both draft validation and the repository reject new multi-exercise submissions. Multiple sets, duplication, removal and order preservation remain. |
| 2. Location creation inside selector | Partial | Complete | Shared `LocationSelect` and `findOrCreateLocation`; normalized duplicate lookup, persisted creation, selection, inline retry, draft preservation, cancellation focus and keyboard action coverage. Settings management remains. |
| 3. Bottom navigation returns home | Partial | Complete | `moduleRevision` remounts module state even on active-tab clicks. `/groups` is canonical; `/leaderboards` remains a readable alias. Modern confirmation protects entry and management drafts. Dialog layering and Escape preserve the underlying draft. |
| 4. Optional notes collapse | Complete | Complete | Controlled values survive collapse and save; existing text starts expanded. Set IDs/client keys retain note identity after duplication/removal. Existing set-order behavior is preserved. |
| 5. Large saved-entry confirmation | Partial | Complete | `Lift Logged` lists every saved set, date and location; repetition, assisted, reps-only, distance and attempts are covered. Exact returned entry ID drives editing. No repeat-entry action. |
| 6. Remove overall Strength duration | Complete | Complete | No active Strength duration label or control. Historical metadata survives repository edits; new overall duration is null. Distance-set, Cardio and timed Flexibility duration remain. |
| 7. Zero-rep attempts | Broken | Complete | Main validation now rejects unsafe integers as well as blank, negative, fractional and nonfinite values. Attempts round-trip as zero and are filtered out before successful performance calculations. |
| 8. Migration 012 | Partial | Complete locally; unapplied | Finished the existing migration. Only the load-mode trigger function and private group summary change. Added safe integer validation and read-only aggregate preservation queries. No existing constraints require replacement. |
| 9. Release announcement | Partial | Complete locally | Stable 2.2 ID, existing server-backed acknowledgement path and account bootstrap gate. Added missing duration-removal copy after functional fixes. Mock-account lifecycle coverage; live persistence still requires QA. |
| Regression / release validation | Partial | See results below | Existing interrupted logs were not treated as proof. Fresh tests, browser fixtures and build checks were run. |

## Confirmed causes and continuation fixes

- The previous implementation changed the URL/module identity without necessarily destroying module-local form, detail, history or success state. An active-module navigation now increments a revision key, closes the add sheet and scrolls to the top. Unsaved checks run before the reset.
- Groups still had `/leaderboards` as its only route. `/groups` now maps to that existing feature and is its generated landing path; old links continue to parse.
- The interrupted run protected entry forms, but omitted Cardio activity management, Flexibility stretch management and an in-progress location dialog. These now register their drafts too. Form identity resets the baseline when opening a different management record.
- A navigation prompt rendered before an existing module dialog could sit underneath it. The prompt now renders last, underlying module content is inert, dialog labels have unique IDs and only the topmost confirmation handles Escape/Tab.
- The main Strength validator used `Number.isInteger`, which accepts unsafe integers. It now uses `Number.isSafeInteger`; migration 012 applies the corresponding upper bound to changed repetition values.
- Migration 007's `enforce_strength_set_load_mode()` rejects reps below one. The foundation already permits nonnegative reps and migration 002 already requires whole reps. Migration 011's group summary counted attempts as set rows and allowed them into chronology. Migration 012 changes those specific gates.
- The initial browser fixture used a fixed startup delay and the runner had a short fixed polling budget. The fixture now waits for application readiness; the runner accepts `FIXTURE_POLLS` and prints page diagnostics on timeout. Browser failures were investigated, not ignored. Server logs also confirmed that hot reload during test edits reloaded a nested history URL outside the fixture; the fixture now disables HMR so such reloads cannot interrupt the scenario. The Supabase module remained mocked even on those failed reloads. A First Entry fixture assertion was corrected to remove an unrelated historical successful baseline from that scenario.

## Zero-rep behavior and calculations

Repetition sets accept integer reps from 0 through 9,007,199,254,740,991. Blank, negative, fractional, nonnumeric, NaN, infinite and unsafe values are rejected. Weight and assistance must remain finite and nonnegative. Reps-only entries do not invent weight. Distance validation is unchanged.

Zero means an unsuccessful attempt. History, details and success show an accessible textual Attempt badge. Attempts remain ordinary editable/deletable history records and remain available to search and pagination.

Attempts contribute nothing to First Entry, Weight PR, Rep PR, One Rep Max, Rep Weight, All Logged Sets performance graphs, monthly/yearly bests, successful set counts, muscle-group counts, Your Sets, group/leaderboard set or PR totals, usage ranking, last successful values or exercise progression. Distance sets still contribute to appropriate set counts.

The affected consumers are `detectRepetitionPrs`, `strengthModePoints` (its existing positive-reps eligibility was retained), Progress parsing/best-set selection, `strengthExerciseUsage`, `getExercises`, `countSetGroups`, `setTrend`, and SQL `private_group_summary`. Filtering happens before PR baselines/window functions. Editing zero to positive or positive to zero reloads evidence and recalculates later achievements. History row counts intentionally still include attempts: they count saved records, not successful performance.

## Migration 012: exact manual sequence

Do not run migrations 001–011 again. Do not apply the frontend release until the database and QA gates are satisfied.

1. Have the database operator confirm that the target project has migrations 001–011 applied and 012 unapplied. Compare the actual function/constraint definitions with this repository; stop if they differ materially. This session inferred the need for 012 from the known migration chain, not a live database inspection.
2. During a window without application writes, run the **PREFLIGHT**, **PRESERVATION SNAPSHOT**, owner/ACL/search-path and trigger queries in `docs/ZERO_REP_012_VERIFICATION.sql`. Export the results. They are read-only. No test inserts or edits are included.
3. Apply the entire existing `supabase/migrations/202609290012_zero_rep_attempts.sql` file as one transaction, from `BEGIN;` through `COMMIT;`, using the project's normal authorized migration process. Do not execute fragments or create a second 012. Do not replay earlier migration files.
4. Run the **POSTFLIGHT** queries and repeat every preservation snapshot and security query. All row counts, numeric sums and non-null duration counts must match the preflight snapshot. Confirm the load-mode trigger remains attached, owners/ACLs/security/search paths are preserved, and RLS is still enabled. Inspect both set-count and PR-source filters in the full group-summary definition, not just the boolean smoke check.
5. Record application of 012 in the project's migration ledger through its normal process. If an application attempt is interrupted, inspect that ledger and the function definitions first. The file uses a transaction and `CREATE OR REPLACE`; retrying an uncommitted attempt is safe, and it contains no data rewrite.
6. On an authorized staging/test account, complete the two-account and device QA below before a separate release decision. This continuation did not authorize or perform deployment.

Changed database objects:

| Object | Change | Preserved |
|---|---|---|
| `public.enforce_strength_set_load_mode()` | Reps `< 1` becomes `< 0`; rejects nonfinite/unsafe reps. | Existing unchanged-row fast path, owner lookup, reps-only no-weight rule, nonnegative weight rule, empty search path, trigger attachment and function ownership. |
| `public.private_group_summary(uuid,text,text,text)` | Successful set predicate before aggregation; positive reps before PR chronology. | Full membership/privacy logic, time bounds, locks, assisted progression, Cardio calculations, SECURITY DEFINER, empty search path, owner and authenticated-only execute grants. |
| Constraints / tables / RLS / RPC schema | No changes. | Existing nonnegative and whole-reps constraints, `save_strength_workout`, all records and historical duration columns. |

The static migration test compares the complete group-summary body against migration 011, allowing only the two intended eligibility changes. SQL execution and live PostgreSQL validation remain unperformed by design.

## Required regression coverage map

| # | Requirement | Local coverage |
|---|---|---|
| 1–3 | One exercise/multiple sets, legacy multi-edit, no repeat-exercise actions | `attempts22.test.ts`, `workoutDuration.test.ts`, `release22.jsx`, `entryEdit.jsx` |
| 4–6 | Location preservation, duplicate selection, failure retry | `locationCreation.test.ts`, `release22.jsx` |
| 7–8 | Every module/nested path returns home; dirty forms prompt | `routing.test.ts`, `groupNavigation.test.ts`, `release22.jsx` (new/history/edit/detail/success/manage paths plus real local form/history/success/dialog states) |
| 9–11 | Notes collapse, existing notes expand, stable note identity | `release22.jsx`, `entryEdit.jsx` |
| 12 | Success tracking modes and achievements | `release22.jsx`: weighted success/First Entry/Weight PR/Rep PR; assisted and reps-only attempts; distance sets and time |
| 13–16 | Hidden overall duration preserved; other durations retained | `workoutDuration.test.ts`, `release22.jsx`, `entryEdit.jsx` |
| 17–18 | Zero round-trip; invalid values rejected | `attempts22.test.ts`, `release22.jsx` |
| 19–22 | Attempts excluded, later baseline, edits recalculate | `attempts22.test.ts`, existing strength/progress tests, `migration012.test.ts`, `release22.jsx` |
| 23–24 | Account-scoped announcement; prior IDs independent | `releaseAnnouncement.test.ts`, `announcementRecovery.jsx` with in-memory account-scoped server |
| 25 | Phone/desktop navigation, dropdown, notes, confirmation layout | `release22.jsx` width matrix and announcement/entry-edit fixtures; real devices still pending |

## Authenticated two-account QA (pending; requires authorized test environment)

1. Confirm 012 is applied and use separate test accounts A and B. Preserve both accounts' existing 2.0/2.1 acknowledgement rows. Verify 2.2 waits for bootstrap and appears for each account independently.
2. In A, force an acknowledgement failure: the dialog must remain with retry. Retry, then refresh, sign out/in, refresh the token, clear local cache, reopen the installed PWA and sign in on another device. The server must keep it dismissed. B must still see its own announcement until B dismisses it.
3. In A, log weighted, assisted and reps-only zero attempts; reload and search History. Verify exact zero and no achievement badges. Verify B cannot read or edit A's entries/locations.
4. Log a later positive set and verify the first successful baseline. Edit it to zero and back; check all later badges, Progress graph modes/tables, muscle totals, Your Sets and shared group set/PR totals. Also verify assisted lower-is-better progression and group privacy/revocation behavior from 2.1.
5. Create/duplicate locations from both entry modules, test no-match search, failure/retry and Cancel. Confirm saved locations survive sign-out/in and appear in Settings. Verify unsaved entry values remain unchanged.
6. Edit an existing one-exercise and a historical multi-exercise workout, including one with stored overall duration. Compare IDs, ordering, timestamps, notes and hidden duration before/after. Verify distance-set duration, Cardio steps/duration and timed Flexibility duration.
7. Exercise each bottom destination from unchanged and dirty new/edit forms, real details/history/success views and management dialogs. Stay preserves drafts; Discard returns to canonical home, closes local overlays and resets scroll. Verify browser back/forward and old `/leaderboards` links.

## iPhone, Android and installed-PWA QA (pending)

At 320, 375, 390 and 430px where devices permit, and on desktop: check one/many-set success, all tracking modes, zero attempts, notes accordions, location no-match/create/retry, stacked confirmation, navigation and the announcement. Use actual Safari and Chrome, then installed standalone mode; browser emulation is not proof of WebKit or physical-device behavior.

Check safe-area/notch and bottom navigation clearance, keyboard opening/closing, focus restoration, VoiceOver/TalkBack labels, arrow/Enter/Space/Escape operation with a hardware keyboard, 44px targets, portrait/landscape, long exercise/location/note text, text zoom and no horizontal overflow. Background/resume the app from a form and success screen. Refresh must not submit again. Check slow/offline saves preserve drafts and acknowledgement failures remain retryable.

## Validation results and exact file inventory

Final results and the full changed-file inventory are recorded below after the final validation run. Pre-existing 2.2 changes were preserved; the inventory includes them, not only edits made during this continuation.

| Validation | Final result |
|---|---|
| Complete Vitest suite | 88 files, 526 tests passed (includes existing 2.1 coverage). |
| Lint | oxlint, zero warnings/errors with --max-warnings=0. |
| TypeScript | tsc -b --pretty false passed. |
| Production build | tsc -b and Vite passed; 719 modules transformed. |
| Whitespace | git diff --check passed. |
| Dependency audit | npm registry audit passed: zero vulnerabilities across 188 dependencies, after explicit approval to disclose dependency metadata. |
| Phone layout/interaction | 197 checks passed at each of 320x568, 375x812, 390x844 and 430x932; no runtime errors or assertion failures. |
| Desktop/tablet | 197 checks passed at each of 768x1024 and 1280x900. |
| Standalone emulation | 197 checks each at 390x844 with Android and iPhone standalone profiles. These use Chromium UA/media emulation, not physical devices or WebKit. |
| Legacy entry editing | 48 checks passed at each required phone width, including actual page refresh and historical value preservation. |
| Announcement lifecycle | 24 browser checks passed with two mocked accounts, retry, remount, token refresh and cross-document acknowledgement. |
| Visual inspection | Captured and inspected the 320px Strength success view: docs/release22-success-320.png. Vertical scrolling is expected for multiple sets at this height. |
| Source/security scans | No native select/alert/confirm/prompt calls; no unsafe reps truthiness matches; no overall Strength duration labels; sole Add Another Exercise occurrence is legacy-only. No service-role JWTs, secret keys or private-key patterns in 245 tracked text files. |
| undefined / NaN review | Remaining undefined occurrences are optional-value handling/type guards; the sole production NaN literal is the intentional invalid-distance sentinel. Validated success rendering contains neither string. Missing historical distance load is omitted rather than displayed as zero. |
| Environment files | .env and .env.local are ignored and untracked. |
| Service worker | Existing exclusions for cross-origin, Supabase, auth, REST, API, functions, storage and non-GET requests remain unchanged. |
| Applied migrations | All eleven migration files 001?011 byte-for-byte equal their HEAD blobs. |

Detailed browser evidence: [release22-browser-results.json](release22-browser-results.json). Review screenshot: [release22-success-320.png](release22-success-320.png).

Reproduce the isolated 2.2 browser run in separate PowerShell terminals:

```powershell
node tests/browser/serveRelease22.mjs
```

```powershell
$env:FIXTURE_URL='http://127.0.0.1:5189/__release22'
$env:FIXTURE_POLLS='1800'
$env:REQUIRED_WIDTHS='1'
node tests/browser/runFocusedRelease.mjs
```

For desktop, clear REQUIRED_WIDTHS and set DESKTOP_ONLY=1. For a single standalone profile, clear DESKTOP_ONLY, set FOCUSED_SINGLE=1 and BROWSER_MODE to android-standalone or ios-standalone-emulated. The server replaces the Supabase module with an in-memory client and applies a local-only connect CSP.

## Remaining release gates

Migration 012 is required but unapplied. Its SQL has only static verification here. Live account ownership/RLS, cross-device acknowledgement persistence and authenticated leaderboard behavior still need the documented two-account QA. Physical iPhone Safari, Android Chrome and installed-PWA QA are incomplete. These prevent a deployment-readiness claim; they do not require further unauthorized live work in this session.

Migrations 001?011 were not changed or rerun. No SQL was executed, no live data changed, no Supabase connection was made, and nothing was deployed or pushed.

## Exact changed / added files relative to HEAD

Includes the interrupted run's preserved work and continuation changes; local validation logs are listed separately by their names. Build output is ignored and is not part of this inventory.

- `.audit22-results.json`
- `.browser22-results.txt`
- `.entry22-results.txt`
- `.test22-results.txt`
- `docs/PROGRESSIVE_OVERLOAD_2_2_REQUIREMENTS.md`
- `docs/PROGRESSIVE_OVERLOAD_2_2_REVIEW.md`
- `docs/ZERO_REP_012_VERIFICATION.sql`
- `docs/release22-browser-results.json`
- `docs/release22-success-320.png`
- `src/App.tsx`
- `src/components/CollapsibleNotes.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/LocationSelect.tsx`
- `src/components/ReleaseAnnouncement.tsx`
- `src/components/SelectionControls.tsx`
- `src/domain/entryFormContract.test.ts`
- `src/domain/launchContract.test.ts`
- `src/domain/routing.test.ts`
- `src/domain/routing.ts`
- `src/features/cardio/CardioFeature.tsx`
- `src/features/flexibility/FlexibilityFeature.tsx`
- `src/features/groups/GroupsFeature.tsx`
- `src/features/progress/ProgressFeature.tsx`
- `src/features/progress/logic.ts`
- `src/features/progress/repository.ts`
- `src/features/strength/StrengthFeature.tsx`
- `src/features/strength/WorkoutCard.tsx`
- `src/features/strength/YourSets.tsx`
- `src/features/strength/attempts22.test.ts`
- `src/features/strength/logic.ts`
- `src/features/strength/migration012.test.ts`
- `src/features/strength/quickLog.ts`
- `src/features/strength/release21Migration.test.ts`
- `src/features/strength/repository.ts`
- `src/features/strength/setBreakdown.ts`
- `src/features/strength/setTrend.ts`
- `src/features/strength/types.ts`
- `src/features/strength/workoutDuration.test.ts`
- `src/features/weight/WeeklyChangeTable.test.tsx`
- `src/features/weight/WeightFeature.tsx`
- `src/index.css`
- `src/lib/locationCreation.test.ts`
- `src/lib/locationCreation.ts`
- `src/lib/releaseAnnouncement.test.ts`
- `src/lib/releaseAnnouncement.ts`
- `src/lib/unsavedNavigation.ts`
- `supabase/migrations/202609290012_zero_rep_attempts.sql`
- `tests/browser/entryEdit.jsx`
- `tests/browser/release21.jsx`
- `tests/browser/release22.jsx`
- `tests/browser/runFocusedRelease.mjs`
- `tests/browser/serveRelease22.mjs`
