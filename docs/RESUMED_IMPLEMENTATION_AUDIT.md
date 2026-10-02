# Resumed implementation audit — October 2, 2026

This supersedes the September 30 completion claims in STRENGTH_STEPS_REVIEW.md. The actual starting worktree contained 23 modified files, 17 already deleted root validation artifacts, and 14 untracked feature/migration/review files. All existing deletions and unrelated work were left in place. No commit, push, deployment, SQL application to Supabase, or live record mutation occurred.

| Requirement | At resumption | After audit and fixes |
|---|---|---|
| Strength PR/Last subtitles, full account evidence | Incorrect: equal weights ignored reps; distance load omitted | Complete locally; weighted and assisted ties compare reps before order, distance includes recorded load |
| Zero attempts, chronology, reps-only, empty/loading history | Complete | Complete, regression suite passes |
| Compact stable set buttons | Partial: generic labels | Complete, 44px minimum height, set-specific accessible labels, interaction coverage |
| Separate Steps form, validation, repository CRUD/history | Complete locally; unavailable in configured database | Complete locally; schema installation still required; local date history bounds corrected |
| Daily Steps graph | Complete locally | Complete; newest saved daily total, chronological dates, integer ticks, gaps retained, date controls tested |
| Timed Cardio totals and mode separation | Incorrect: same name could merge legacy timed and Steps records | Complete locally; separate mode keys and only timed records enter charts/aggregates |
| Sets by Muscle Group | Complete locally | Complete; Monthly default, Monday weeks, actual sets, primary group, no padded empty periods or daily points |
| Progress mobile overflow | Partial: old fixture omitted most tabs/body checks | Complete for automated Chrome/WebKit matrix; physical-device QA outstanding |
| Migration 013 raw SQL | Complete locally | Executes on disposable PostgreSQL; migration file itself was not edited in this resumed run |
| Database/RLS/account compatibility | Partial | Disposable account/RLS/preservation/RPC checks pass; real authenticated QA outstanding |
| Git/upload | Partial: intended files untracked/uncommitted | Audited; committed main equals origin/main, changes still uncommitted/unpushed |

Production fixes are in the actual Strength selector/helper/repository, Cardio Progress, Cardio history repository, Bodyweight history rows, chart components, and shared table sizing. They are not fixture-only changes.

## Confirmed overflow causes and repair

At 320px, a wide Strength period table made body.scrollWidth reach 2691px while documentElement.scrollWidth remained 320px. Mobile Chrome expanded its layout viewport, placing fixed navigation beyond the visible screen. Bounding the sticky exercise-name column reduced this but did not eliminate it. Inline-size/layout containment on explicit horizontal scroll wrappers removed the table's contribution to outer layout while retaining its accessible keyboard/touch scroll area. No global horizontal clipping was added.

A Cardio tooltip extended to x=356px in a 320px viewport. Chart tooltips now anchor at the chart's upper left and wrap within the parent. Long Bodyweight history metadata pushed Edit/Delete buttons to x=336px; those rows now wrap. ResponsiveContainer uses minWidth=0, the existing safe grid/flex/card sizing remains, legends wrap, and portal menus are checked at their scrollable wrapper.

## Database evidence and limits

Read-only requests to the Supabase project configured in .env.local requested zero rows and only the tracking_mode column on cardio_activities and cardio_sessions. Both returned HTTP 400 / PostgreSQL 42703 (undefined column). Therefore 013 is not available in that configured schema. No credentials, project endpoint, or records were printed or saved. This is not authenticated database QA and cannot prove what happened in a different Supabase project.

Migration 013 is transaction-wrapped and forward-only. It adds configuration columns, preserves existing timed values/timestamps with a preservation assertion, retains ownership FKs/RLS, and excludes Steps in the group RPC. Existing migration 001–012 hashes match both the prior evidence and HEAD. The raw 013 file successfully executes in PGlite embedded PostgreSQL with disposable auth fixtures and pgcrypto after all prior migrations; this is not a hosted Supabase rehearsal.

The disposable SQL checks verify existing/future private Steps installation, unchanged original sessions, valid Steps writes, invalid inputs and incompatible metrics, account isolation, foreign activity rejection, denied browser installer execution, the group RPC's timed totals, and parsing/execution of status/preflight/postflight scripts. Companion preflight/postflight files had leading BOM bytes removed after PostgreSQL rejected them. Migration 013 itself needed no edit.

PostgreSQL explicitly casts a numeric SQL literal such as 1.5 to an integer by rounding before an integer-column trigger sees it. Text/API integer input rejects fractions, and application validation rejects fractional text before submission. The disposable test checks fractional text input; it does not claim to prohibit deliberate SQL casts.

## Validation and remaining QA

The full Vitest suite passes 569 tests in 94 files. Lint has zero warnings/errors; TypeScript, production build, git diff --check, and dependency audit pass. Dependency audit has zero vulnerabilities. Safety searches found no production native dialogs/selects, credential/private-key patterns, or malformed 013 escapes. .env/.env.local remain ignored and untracked.

Browser evidence: progress-audit-browser-results.json, plus per-engine files. Chrome and actual Playwright WebKit each run production Progress/navigation and entry fixtures at 320×568, 375×812, 390×844, 393×852, 430×932, 768×1024, and 1280×900: 28 cases, 10,856 assertions, no failures/runtime errors. These cover Strength modes and exercise types, Weekly/Monthly muscle aggregation, Steps/custom date filtering, legacy timed Steps, all timed Cardio metrics, Flexibility, Bodyweight styles/pagination, expanded Chart Controls, long text, menus/tooltips, document/body/shell widths, internal table scrolling, and mobile navigation visibility/touch/click behavior. This does not claim physical iOS/Android or authenticated application testing.

Before deployment: install/verify 013 on the intended database; perform authenticated two-account CRUD/RLS tests and preservation comparisons; test physical iOS Safari and Android Chrome/PWA; review/commit/push the worktree. Do not deploy the schema-dependent frontend to a database with only 001–012.

## Manual migration sequence

1. Select the intended Supabase project and migration-owner SQL Editor role. Run only STRENGTH_STEPS_013_STATUS.sql first. Compare the returned columns, functions, enabled triggers, CHECK constraints, and RPC body with 013.
2. If 013 is already fully installed there, do not rerun it. Run STRENGTH_STEPS_013_POSTFLIGHT.sql read-only and perform authenticated QA. If evidence is partial/different, investigate before applying anything.
3. If 013 is absent, take the normal backup and run STRENGTH_STEPS_013_PREFLIGHT.sql. Export the original session/activity/policy/grant/owner/trigger results privately. Resolve any duplicate normalized Steps names without deleting history. Rehearse on a disposable copy of the real schema/data if required by your database workflow.
4. Paste the entire raw supabase/migrations/202609300013_cardio_steps_activity.sql into the SQL Editor and execute once, including its BEGIN/COMMIT. Do not run 001–012 again. If it fails, stop; verify rollback and investigate the error rather than blindly rerunning or manually changing historical records.
5. Run STRENGTH_STEPS_013_STATUS.sql and STRENGTH_STEPS_013_POSTFLIGHT.sql. Compare original sessions/timestamps and original activity identities/customization with the preflight exports. Verify RLS/policies/grants/owners, function privileges/search paths, and enabled triggers. Then perform authenticated A/B/new-account Steps and timed-entry QA before deployment.

## Git review and upload commands (not executed)

Run these from the workspace after reviewing the complete diff and untracked files. The add command includes the intended source, migration, tests, and review/evidence files; it leaves the 17 pre-existing root artifact deletions unstaged so they are not silently included in this feature commit.

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
git diff --check
git add -- .gitignore src docs tests/browser supabase/migrations/202609300013_cardio_steps_activity.sql
git diff --cached --stat
git diff --cached
git commit -m "Restore Strength summaries and complete Steps and Progress fixes"
git push origin main
git fetch origin
git rev-list --left-right --count origin/main...main
git rev-parse main
git rev-parse origin/main
git status --short
```

Expected equality verification: 0 0 and identical main/origin/main hashes. The existing root validation-artifact deletions remain visible in status unless separately reviewed and staged. If they are intentional cleanup, review them and use git add -u for those exact paths before committing; do not stage unrelated changes blindly.

All new feature, SQL, browser, and evidence files reported by git ls-files --others --exclude-standard should be included. Ignored .env.local, dist/, node_modules/, and root scratch validation outputs should not be committed. No ignored release asset requiring inclusion was found; existing tracked public release files remain tracked.

Final status: **READY FOR MIGRATION 013**. Local changes are reviewable and tested; configured database schema installation, real authenticated/RLS and physical-device QA, and commit/push/deployment remain outstanding.
