# Strength muscle-group chart repair

## Confirmed root cause

The current source does NOT expand Monthly into daily rows or add missing months. The defect is in the group values inside existing month records: setTrend populated all seven muscle groups with numbers, including zero for absent groups. SetsByMuscleGroup rendered dots for every group on every period, so absent groups produced bottom-of-chart points and misleading drops. With two months, the old dataset supplied 14 persistent group dots, even though only four group-period values existed. The selectable monotone line mode also smoothed aggregate counts unnecessarily.

The repair keeps the already-correct calendar bucketing, emits null for absent group values, draws markers only for finite positive totals, uses explicit categorical period keys and straight lines, and sets connectNulls=false. This fixes the source data and rendering path rather than hiding marks with CSS. Empty periods remain absent. Monthly remains default; Weekly and Monthly are the only aggregation options.

Adjacent recorded periods are connected directly, even when an entirely empty calendar period is omitted. This is explicitly explained below the chart: lines do not estimate missing periods. If a represented period has no sets for a particular group, its null breaks that group's line. No intermediate records or numeric values are generated.

## Calculation/rendering audit

1. ProgressFeature loads Strength using loadStrengthProgressRows. This is a complete account-owned query against strength_sets with eq(user_id,userId), stable ID ordering and pagination in batches of 500. It selects set ID, tracking/repetition fields, the exercise's primary major_muscle_group, and workout performed_at/created_at/location. It does not use the visible History page. Errors are surfaced and stale account publications are already guarded; this repair leaves that behavior intact.
2. Date-only performed values are local calendar days. Timestamp values are converted to local calendar days by localDateKey. Invalid dates are excluded. Creation dates do not control volume buckets; they continue to control chronological PR ordering where appropriate.
3. Zero-rep attempts are excluded. Existing successful-distance qualification is preserved. Set IDs are deduplicated; date-range/location filtering is applied before grouping. The selected date range limits the contributing sets, so a range cutting through a month/week produces the total within that range, without synthetic dates.
4. countSetGroups uses only the primary major muscle group, with Olympic/Other fallback; compound tags and secondary groups do not duplicate a set. It shares the existing wheel's exact seven categories/colors.
5. Monthly keys are YYYY-MM. Weekly keys are the local Monday date, Monday through Sunday, using calendar date arithmetic through DST/year boundaries. Periods are sorted by parsed real local dates, independent of insertion order. Entirely empty months/weeks are omitted. Absent group values inside represented periods are now null.
6. Recharts receives that aggregate array directly. XAxis is explicitly categorical, allows no duplicate categories, and uses sparse real period ticks (at most four on phone chart widths). Labels never expand a period into daily data. Every positive group-period value gets one persistent marker. Hover highlights are additional temporary markers for the same real value, not extra records.
7. Lines use linear geometry and connectNulls=false. Switching aggregation remounts the chart to clear stale hover/cursor state. Active markers use the series fill color rather than Recharts' white marker stroke. The global Progress line-style control continues to apply to individual-performance charts; it no longer smooths this aggregate volume chart.
8. Monthly tooltip titles use full month/year (January 2026). Weekly titles use calendar ranges (Jan 5-11, 2026, rendered with an en dash), including cross-month/year ranges. Tooltips include only positive values for visible muscle groups, plus the period total. Markers, lines and tooltip labels reuse Your Sets colors exactly.

## Before/after regression example

The fixture models the supplied example; no screenshot attachment was available for direct comparison.

14 source sets: 13 completed sets on five workout dates, plus one zero-rep attempt in February. January 3 has Chest 3; January 20 Chest 2; January 25 Legs 4; March 4 Chest 1; March 9 Arms 3.

Both old and new calendar aggregation produce two record keys: `2026-01`, `2026-03`. The change eliminates false zero group points, not actual daily records (none existed in current code).

| Period | Chest | Legs | Arms | Other absent groups | Total |
| --- | ---: | ---: | ---: | --- | ---: |
| January before | 5 | 4 | 0 | 0 each | 9 |
| March before | 1 | 0 | 3 | 0 each | 4 |
| January after | 5 | 4 | null | null each | 9 |
| March after | 1 | null | 3 | null each | 4 |

After: exactly two monthly records and four persistent markers: January Chest 5, January Legs 4, March Chest 1, March Arms 3. There is no February record, no February-zero marker, no daily monthly-output keys, and no extra workout-date records. Weekly fixture keys are `2025-12-29`, `2026-01-19`, `2026-03-02`, `2026-03-09`; intervening empty weeks are absent.

## Compact PR summaries

Your Sets continues to use its October 8 complete-account dataset and exclusive chronological PR rules, unchanged. Its Weight PR and Rep PR summaries reuse the same `pr-weight` and `pr-reps` classes as Leaderboards. Green is #16803a with white text; blue is #dbeafe with #1e40af text. No new color shades or gradients were added. Decorative trophy/medal SVGs sit beside accessible definition-list labels, prominent numeric totals and selected-period context. The existing polite live region remains.

Summaries are side-by-side at all tested widths, about 59px high at 320px and 46px at 375/390/430px and desktop. All five wheel timeframes remain available and use the same complete-data count calculation: This Month, Past 3 Months, Past 6 Months, Past Year and All Time. No PR results are persisted.

## Exact files changed by this repair

Production code:
- src/features/strength/setTrend.ts
- src/features/strength/SetsByMuscleGroup.tsx
- src/features/strength/YourSets.tsx
- src/features/progress/ProgressFeature.tsx
- src/index.css

Tests/fixtures:
- src/features/strength/setTrend.test.ts
- src/features/strength/setTrendHotfix.test.ts
- src/features/strength/setTrendRegression.test.tsx
- tests/browser/muscleTrend.jsx
- tests/browser/serveMuscleTrend.mjs
- tests/browser/runMuscleTrend.mjs

Documentation/evidence:
- docs/MUSCLE_TREND_REPAIR_REVIEW.md
- docs/muscle-trend-rendered-results.json
- docs/muscle-trend-dependency-audit.json
- docs/muscle-trend-screenshots/screen-320.png
- docs/muscle-trend-screenshots/screen-375.png
- docs/muscle-trend-screenshots/screen-390.png
- docs/muscle-trend-screenshots/screen-430.png
- docs/muscle-trend-screenshots/screen-1280.png

Other uncommitted October 8 Strength/authentication changes and pre-existing scratch-file deletions were preserved. Auth code, the full-account query, PR calculations, package lock and migrations were not changed by this repair.

## Validation

- Focused aggregation/regression tests: 31 tests pass across 3 files.
- Full suite: 592 tests pass across 97 files, including previous authentication/startup tests and full-account PR period tests.
- Lint: `npm run lint -- --deny-warnings`, zero warnings/errors.
- TypeScript: `npm run typecheck`, passes.
- Production build: `npm run build`, passes.
- `git diff --check`, passes; Git's CRLF normalization notices are not whitespace errors.
- Dependency audit: zero vulnerabilities; saved in muscle-trend-dependency-audit.json. No dependency changes were necessary in this repair.
- Real browser DOM/SVG checks: Chromium at 320x568, 375x812, 390x844, 430x932 and desktop 1280x900. No horizontal page overflow. Actual marker counts/period keys/group colors, monthly and weekly tooltips, aggregation switching, wheel All Time selection, summary colors and side-by-side height all pass. The rendered results report 14 source sets, 13 completed sets, exactly 2 monthly records and the keys above at every viewport.
- Screenshots saved for all five widths. Chrome's old test runner's in-process GPU option produced unreliable captures; this task's isolated runner removes that flag and uses stable software screenshots. The new runner also sizes the native backing viewport and forces a compositor repaint for accurate captures. The old runner was not modified.

To reproduce: run `node tests/browser/serveMuscleTrend.mjs` in one terminal, then `node tests/browser/runMuscleTrend.mjs` in another. The fixture uses local mocked data, an isolated temporary Chrome profile and no Supabase writes. The chart/summary components themselves are the production components.

## Remaining blockers / migration

No implementation blocker remains for this chart/style repair. Physical-device, native Safari and authenticated Supabase QA were not performed; the recorded checks are Chromium viewport tests with mocked data. The prior authentication report's production-origin/live-diagnosis blockers remain unchanged and this presentation repair does not establish production auth readiness.

No migration is required. No migration was edited or applied, including migration 014. No live user data, auth accounts, SQL, commit, push or deployment was performed.
