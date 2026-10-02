> Historical September 30 report. Its completion claims are superseded by [the October 2 resumed audit](RESUMED_IMPLEMENTATION_AUDIT.md), including corrected Strength ties, full Progress overflow checks, and current live schema evidence.

# Strength selector, Steps, and muscle-set review

Local implementation review, 2026-09-30. No SQL was executed, no Supabase connection was made, no live records were changed, and nothing was deployed or pushed. Migrations 001–012 were not edited; their current byte hashes are in `strength-steps-validation.json`. Migration 013 is authored and **unapplied**. This is not a deployment-readiness claim.

The initial working tree had four modified Strength files and one untracked summary helper, with no staged changes. Those changes were audited and completed. No unrelated source changes were discarded. Old tracked root-level validation result files were removed under the requested cleanup; intentional evidence under `docs/` was preserved.

| Requirement | Before | After local work |
|---|---|---|
| Weighted, assisted, reps-only, distance selector summaries | Partial | Complete |
| Exact entry chronology and first tied set | Broken | Complete |
| New/edit selector wiring, search, keyboard, accessible summary | Partial | Complete |
| Full account evidence, optional failure, stale-request protection | Partial | Complete |
| Summary refresh after create/edit/delete/reassignment | Partial | Complete through shared reload path |
| Compact Duplicate/Remove styling, stable IDs, one-set guard | Partial | Complete |
| Explicit private Steps activity for existing/future accounts | Missing | Complete in unapplied 013 |
| Normalized starter matching, rename/archive safety | Missing | Complete in unapplied 013 |
| Steps-only form, validation and null timed metrics | Missing | Complete |
| Confirmation before conversion and failed-save retention | Missing | Complete |
| Legacy timed step counts and original chronology | Partial | Complete |
| Steps repository, history, edit, delete, success actions | Partial | Complete |
| Daily Steps graph, duplicate rule, gaps, integer axes | Partial | Complete |
| Steps exclusion from timed Groups comparisons | Missing | Complete in unapplied 013 |
| Weekly/monthly actual muscle-set buckets | Partial | Complete; original code already bucketed |
| Active-bucket zeros, empty-period omission, primary group | Partial | Complete |
| Shared colors, integer ticks, Partial labels, phone labels | Partial | Complete |
| Focused regression fixtures and local browser interaction | Partial | Complete for recorded coverage below |
| Interrupted-work cleanup and local validation | Partial | Complete |
| Authenticated database/RLS and real-device QA | Missing | Partial: checklist prepared, execution intentionally outstanding |

The confirmed Strength cause was presentation wiring: the original logging picker rendered muscle groups and tracking type, never the existing `exerciseLogSubtitle` helper. The old repository calculation also truncated performed times to days, mixed separate entries on one day, and preferred higher reps for equal weight. The interrupted helper still used higher reps/chronology for ties and had incorrect generic `PR` wording. The interrupted button classes had no CSS. These are corrected.

For the muscle graph, this checkout did **not** reproduce the claimed daily-expansion calculation: it already passed Weekly/Monthly to `setTrend`, emitted calendar buckets, and defaulted to Monthly. Confirmed issues were empty interior bucket padding, a hidden weekly-only 12-week cutoff when All Time was selected, and missing distance eligibility checks. Empty periods are now omitted, both modes use the selected date bounds, invalid distance evidence is excluded, and the existing Straight/Smooth control reaches this graph. We cannot attribute an earlier screenshot to a specific unavailable build or claim that daily expansion was found here.

Weight PR is the greatest actual successful weight across all logged locations, normalized for mixed lb/kg storage. Assisted exercises use the minimum successful assistance, including zero. Reps Only uses maximum successful reps. Zero-rep attempts, missing parent entries, and incompatible/invalid evidence do not establish PR or Last; no estimated 1RM is used. Distance evidence compares recorded per-lap distance in common units, then available laps or duration for legacy evidence; unavailable fields are omitted.

Last first selects the most recent successful entry by performed timestamp, original creation timestamp, set order, and stable set ID. Within that entry it selects maximum weight, minimum assistance, maximum reps, or strongest available distance result. Performance ties retain the first set by ascending set order then stable ID, and reps come from that exact set. Attempt-only and no-history states are distinct. PR and Last remain separate in the visual and accessible summary.

The feature loads three account-scoped catalog/assignment queries. It reuses one full Strength evidence query sequence for both selector summaries and PR badges: 500-row pages, ordered by ID, with ownership relationship hints. Request count depends on history pages, never exercise count (no N+1). It does not use the current History page. Location and recent-workout queries are separate. Optional summary failure leaves the logger available; summaries show loading/unavailable states. A generation counter ignores obsolete completions after reload, account changes and unmount. Create, edit, delete and exercise-management/reassignment use the same reload path.

Steps entries store numeric integers 1–2,147,483,647, matching the existing PostgreSQL integer column. Blank, zero, negative, fractional, nonnumeric, infinite and unsafe values are rejected. Steps uses date, optional location and notes; duration/distance/unit/speed/laps/incline/difficulty are null. Repository parsing retains null duration. Conversion stages a new draft and lists populated incompatible metrics; Cancel retains the old draft, Confirm clears only incompatible metrics, and failed saves keep the form. Timed-to-timed changes retain legacy steps. Step configuration is explicit, independent of the activity name.

Migration 013 adds both activity and entry tracking modes. Existing session modes become timed without changing any existing performance values or timestamps. An existing normalized Steps activity becomes step-configured, while its historical sessions remain timed. Those sessions can still be edited without silently converting them. New Steps writes require the Steps mode and null timed metrics. An account-scoped, invoker-rights trigger validates direct writes against the owned activity; ownership FKs and RLS remain intact. Activity mode changes are blocked after installation, while renaming/archiving/deleting unused activities remain supported. Ambiguous multiple normalized Steps activities abort the migration for review instead of choosing or deleting one. Existing archived activities remain archived.

Duration was already nullable in migration 001; 013 is required for explicit modes, private starters and cross-table validation, not for dropping a NOT NULL constraint. New/changed timed durations require whole seconds 1–359999. Historical unchanged null/zero durations remain preservable. Step installers and trigger functions have revoked browser execution, and SECURITY DEFINER installers use an empty search path. The existing leaderboard function is replaced with its 012 definition plus exactly two timed-entry filters; its security, privacy checks, owner and grants are retained. Steps is excluded from timed comparisons rather than assigned a misleading ranking.

Daily Steps Progress uses only saved entry mode `steps`, defaults to an activity with that mode when present, and never mixes optional timed-entry steps into the all-day line. For duplicate local dates, the newest `updated_at` (or `created_at` fallback), then lexicographically greatest stable ID wins. Records are not summed or deleted. Every record remains in History. Dates are parsed and sorted; missing days are omitted. The form explains the duplicate rule. Cards show latest recorded steps, average over recorded days, and recorded-day count. Custom date and Y controls remain available; tick positions are whole, nonnegative numbers with thousands separators, even with fractional custom bounds.

Muscle-set counts deduplicate stable set IDs, exclude zero-rep attempts and invalid distance evidence, and use the exercise's primary major group once. Dip variants remain Arms through the existing applied catalog configuration. Weekly keys are local Monday dates; monthly keys are YYYY-MM. Date/location filtering happens before aggregation. Each active bucket has one count per group; an absent group has one bucket-level zero. Entirely empty weeks/months are omitted. Colors come from the same array as Your Sets. Current periods say Partial; month tooltips show month/year. Straight is the default; Smooth is honored only when explicitly selected.

The focused seven-workout fixture (Sep 21–27, 2026) yields one weekly row `{date:'2026-09-21', total:7, Chest:7}` and one monthly row `{date:'2026-09', total:7, Chest:7}`. Adding Oct 1 creates weekly keys Sep 21/Sep 28 and monthly keys Sep/Oct. No daily or duplicate bucket keys are emitted. Tests also cover Sunday/Monday, year/month boundaries, leap day, local DST dates, out-of-order input, zero attempts, multi-tags, multiple sets, colors, filtering, input immutability and responsive label limits.

Validation evidence is saved in `strength-steps-validation.json`:

- Complete Vitest suite: 565 tests passed across 93 files.
- Lint: zero warnings/errors. TypeScript and production build passed. `git diff --check` passed (Git may print line-ending conversion notices).
- Dependency audit: zero known vulnerabilities. Initial sandbox registry access failed; the read-only network retry succeeded. No dependencies changed.
- Isolated Chromium: 38 interaction/layout checks at each of 320, 375, 390, 430, 768 and 1280px; 228 checks total, zero failures and runtime errors. Fixtures use local in-memory repositories and CSP blocking external connections.
- Checks include summary display/failure, Enter selection, highlighting, button sizing/focus, duplicate/remove values and notes, conversion cancellation, failed Steps save, exact save/reload/edit/history, deletion summary, Progress default, weekly/monthly switching, and page overflow.
- Existing regression tests cover Strength zero attempts/assistance, Flexibility, Bodyweight, Groups, locations and timed Cardio. Browser fixtures do not prove real database RLS or real-device behavior.
- `.env` and `.env.local` remain ignored and untracked. No credential/private-key patterns were found in tracked source/configuration. No secret values were printed. The service-worker exclusion tests pass for Supabase/auth/API traffic.
- No new release announcement, native selects/dialogs, or debug logging was introduced. Scratch validation output is ignored; persistent evidence lives under `docs/`.

The review/application sequence is for a later authorized operator; none of these SQL steps was executed here:

1. Review 013 and both companion SQL files against the actual applied 001–012 schema and take the normal database backup.
2. Run only `STRENGTH_STEPS_013_PREFLIGHT.sql` read-only checks; export exact session snapshots, activity identity/customization, policies, owners, grants and trigger definitions. Resolve normalized-name ambiguities without modifying historical performance.
3. Rehearse 013 once on a disposable copy using the migration-owner role. Confirm preservation assertion, future-account installation, direct-write validation and privacy tests. Do not rerun 001–012 and do not invoke installers from a browser role.
4. After separate approval, apply the one forward-only `202609300013_cardio_steps_activity.sql` transaction. Failure rolls back that transaction; investigate rather than manually rewriting history.
5. Run `STRENGTH_STEPS_013_POSTFLIGHT.sql`. Compare exported original session JSON byte-for-byte logically, original timestamps, activity identities/customizations, table policies/grants/owners, and existing function owner. Check new helper functions are not executable by anon/authenticated and SECURITY DEFINER search paths are empty.
6. Perform the authenticated QA below before making the schema-dependent frontend available. This branch expects 013; do not deploy it against only 001–012.

Authenticated/manual QA still required:

- Account A/B: verify one private Steps starter for existing and new users, normalized-name reuse, and no cross-account reads/writes through direct table access, activity/location IDs or History/Progress. Verify archived starter behavior and ambiguous-name preflight.
- Direct writes: reject missing/zero/fractional steps, incompatible metrics, Steps-mode entries against timed activities, arbitrary mode edits, and missing timed duration; verify installer execution is denied to browser roles.
- Compare all pre/post snapshots. Edit historical Running/Treadmill steps and historical timed entries under a renamed/reconfigured Steps activity without losing metrics, IDs, timestamps, notes or locations.
- On iOS Safari and Android Chrome/PWA at the required widths: check keyboard focus, numeric keyboard, touch targets, safe wrapping, conversion Cancel/Confirm, failed-save retry, create/edit/delete/history/search/pagination and Progress reload.
- Strength: multiple same-day entries, tied sets with different reps, assisted zero assistance, zero-rep attempts, reps-only, distance, lb/kg, deletion/reassignment refresh, delayed account-switch requests and optional-query failure.
- Steps: same-day duplicates with edit timestamps and stable-ID ties; confirm one daily plotted value, every History row retained, missing days omitted, custom date/Y bounds and integer ticks. Check renamed step activities remain step-based.
- Muscle graph: inspect the supplied seven-day fixture, Weekly/Monthly switch, date filtering across week/month/year/DST boundaries, legend colors and partial-period tooltips.
- Groups: Steps entries absent from timed comparisons; timed entries and existing privacy rules unchanged. Smoke-test Strength, Flexibility, Bodyweight and location workflows.

Genuine remaining blockers are the deliberately unapplied migration, unexecuted database/RLS validation, and authenticated real-device QA. The unavailable earlier screenshot/build prevents confirmation of its original daily-spike cause; the current calculation and its documented fixtures have been validated locally.

Exact working-tree file changes (M = modified, A = new/untracked, D = removed generated scratch artifact):

| Status | File |
|---|---|
| D | .announcement21-results.txt |
| D | .audit-results.json |
| D | .audit22-results.json |
| D | .browser21-results.txt |
| D | .browser22-results.txt |
| D | .build-results.txt |
| D | .desktop21-results.txt |
| D | .entry22-results.txt |
| D | .focused21-results.txt |
| M | .gitignore |
| D | .leaderboards21-desktop-results.txt |
| D | .leaderboards21-results.txt |
| D | .lint-results.txt |
| D | .mobile21-results.txt |
| D | .security21-results.json |
| D | .test-results.txt |
| D | .test22-results.txt |
| D | .typecheck-results.txt |
| M | src/components/EntrySuccessActions.tsx |
| M | src/features/cardio/CardioFeature.tsx |
| M | src/features/cardio/DurationWheel.test.ts |
| M | src/features/cardio/StepsProgress.tsx |
| M | src/features/cardio/entryDraft.test.ts |
| M | src/features/cardio/entryDraft.ts |
| M | src/features/cardio/repository.ts |
| M | src/features/cardio/steps.test.ts |
| M | src/features/cardio/steps.ts |
| M | src/features/progress/ProgressFeature.tsx |
| M | src/features/progress/repository.test.ts |
| M | src/features/progress/repository.ts |
| M | src/features/repositoryRelationships.test.ts |
| M | src/features/strength/SetsByMuscleGroup.tsx |
| M | src/features/strength/StrengthFeature.tsx |
| M | src/features/strength/repository.ts |
| M | src/features/strength/searchMetadata.test.ts |
| M | src/features/strength/searchMetadata.ts |
| M | src/features/strength/setTrend.test.ts |
| M | src/features/strength/setTrend.ts |
| M | src/features/strength/types.ts |
| M | src/index.css |
| A | docs/STRENGTH_STEPS_013_POSTFLIGHT.sql |
| A | docs/STRENGTH_STEPS_013_PREFLIGHT.sql |
| A | docs/STRENGTH_STEPS_REVIEW.md |
| A | docs/strength-steps-validation.json |
| A | src/features/cardio/stepAxis.test.ts |
| A | src/features/cardio/stepAxis.ts |
| A | src/features/cardio/stepsActivity.test.ts |
| A | src/features/cardio/stepsMigration.test.ts |
| A | src/features/strength/exerciseSummary.test.ts |
| A | src/features/strength/exerciseSummary.ts |
| A | src/features/strength/setTrendHotfix.test.ts |
| A | supabase/migrations/202609300013_cardio_steps_activity.sql |
| A | tests/browser/serveStrengthSteps.mjs |
| A | tests/browser/strengthSteps.jsx |
