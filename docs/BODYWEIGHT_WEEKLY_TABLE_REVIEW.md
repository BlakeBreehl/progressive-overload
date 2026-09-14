# Bodyweight weekly table completion

The weekly-table implementation and automated validation passed. This is ready for migration 009 review, not deployment readiness. No SQL, remote data mutation, push, deployment, or migration application occurred.

## Removed

Removed Bodyweight's absolute-change and percentage-change line charts, their shared change Chart Controls, aggregation selector, zero reference lines, change tooltips, axis-domain calculations, chart labels and graph-only imports. Repository-wide reference search confirmed no other screens depended on calendarChanges.ts; that unused weekly/monthly graph calculator and calendarChanges.test.ts were deleted. Their relevant weekly calculation cases were replaced by expanded table tests. No dedicated change-graph stylesheet existed; shared chart controls and styles remain for other charts.

## Table rules

- Use the selected Morning, Evening or combined readings and normalize lb/kg into the displayed unit on copies only.
- Group valid readings by local calendar day, average each day, then average the available daily means within Monday?Sunday weeks. Each measured day has equal weight. Empty days/weeks create no values or fabricated zeroes.
- Compare against exactly the preceding Monday?Sunday week. A missing preceding average produces a dash, even if an older week exists. Absolute change is current minus previous; percent is change divided by previous times 100. Previous zero leaves percentage unavailable but preserves valid absolute change.
- Do not round calculation inputs. Display averages and absolute changes to one decimal and percentages to two. Positive displayed changes have a plus sign; negative changes retain minus; rounded zero has no misleading negative sign. Styling is neutral.
- Current week is Partial until the next Monday, including on Sunday. Future/invalid/nonfinite readings are excluded from this summary without modifying their records.
- Newest first, 12 rows per page. Morning/Evening filtering happens before aggregation; weekly 3/6/12-month or All Time filtering happens before pagination. Calendar-month cutoffs expand to full weeks, retaining earlier adjacent-week evidence for the first visible comparison.
- The weekly range is independent of reading-history/line-chart date controls. The main reading visibility selector applies to both. A scrollable, keyboard-focusable region preserves readable columns on phones. Caption explains the calculation and dash meaning.

The Morning/Evening line graph retains null connections, equal thin red/black lines and Straight/Smooth. Existing entry/history flows and weekly/monthly rolling summary cards remain. The announcement copy now covers all requested features; progressive-overload-2.0-launch and existing dismissal/session persistence code were not changed during this pass.

## Files in this pass

Modified: src/features/weight/WeightFeature.tsx; src/components/Pagination.tsx (optional accessible navigation label, existing default preserved); src/components/ReleaseAnnouncement.tsx (copy only).
Added: src/features/weight/weeklySummary.ts; src/features/weight/WeeklyChangeTable.tsx; their two test files; this review document.
Deleted: src/features/weight/calendarChanges.ts and calendarChanges.test.ts.
Earlier uncommitted Groups/repair work was preserved. No dependency, environment, migration, database, generated-build tracked file or unrelated source edits were introduced by this pass.

## Validation

- Full suite: 285 tests in 59 files passed, including existing Groups/RLS source contracts, PR/unit, navigation, history, line-chart and announcement dismissal tests.
- New table tests: 19 cases, replacing three obsolete graph-calculator tests. Cover daily weighting, independent periods, missing days/weeks, partial weeks, signed/zero changes, zero denominator, mixed units/immutability, rounding, Sunday/Monday, month/year boundaries, leap day, DST, sorting, all range choices, filtering before pagination, prior evidence outside range, invalid data, accessible table markup and announcement copy/stable identity.
- Focused 19 cases also passed with TZ=America/New_York.
- Lint: zero warnings. TypeScript, production build and git diff --check passed.
- Dependency audit: zero vulnerabilities.
- Isolated Chrome using actual server-rendered table markup and production CSS at 320/375/390/430 pixels: no page overflow; inner table scrolls with 560px minimum width. This was a local layout fixture, not authenticated browser testing.
- Searches found no remaining removed change-chart symbols/labels in src, and no native select/alert/confirm/prompt in active TSX.
- SHA-256 comparison against start-of-pass snapshots confirmed all migrations 001?009 byte-for-byte unchanged. .env, .env.local and dist remain ignored/untracked.

## Remaining gates and exact next steps

Migration 009 is unapplied and its PostgreSQL execution and authenticated cross-account behavior have not been tested. These are genuine deployment gates. The existing client requires its new Strength unit column. Do not deploy first.

1. Review supabase/migrations/202609140009_private_groups_and_leaderboards.sql and docs/GROUPS_009_REVIEW.md in full, especially grants, SECURITY DEFINER functions, membership/owner checks, hashed invites and unit provenance. Confirm target migrations 001?008 and the confirmed legacy lb assumption.
2. Obtain separate approval for database work. Use disposable staging first; take a secure backup and baseline personal record counts/IDs/numeric values.
3. In that staging project's SQL editor, manually paste and execute the complete 009 file as its single transaction. Do not run a broad migration push or any historical backfill.
4. Run the read-only schema/grant/function/unit checks listed in GROUPS_009_REVIEW.md; compare personal data against the baseline.
5. Run its authenticated sequence with at least two accounts (three recommended for unrelated-group isolation): consent, invite rotation/revocation, role escalation denials, raw-data isolation, member removal/leave/delete, and Strength/Cardio totals. SQL-editor administrator reads alone do not prove RLS.
6. Verify weekly summaries with disposable mixed-unit readings; confirm reading chart/history/edit/delete, summary cards, mobile controls, and one-time announcement. Only after staging migration and authenticated testing pass, separately review approval for production application and deployment. Nothing in this pass authorizes those actions.
