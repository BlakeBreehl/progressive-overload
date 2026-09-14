# Mobile, history, PR, and Bodyweight repair pass

Implemented locally, without deployment, pushing, SQL execution, migrations, or live data changes. Existing Bodyweight backfill files and migrations remain untouched.

## Changes

- Equal-width mobile navigation, compact icons and labels, 44px minimum button height, retained safe-area padding. All 16 module combinations are covered by navigation logic tests.
- Removed the floating Add rendering, styles, and unused contextual routing helper. Home's chooser and module entry buttons remain.
- Removed Strength's standalone location manager and the unused legacy Settings implementation. Settings adds location search. Strength and Cardio entry forms use searchable selectors with private inline location creation, normalized duplicate checks, immediate selection, and retryable errors.
- History and Progress use the same dynamically computed PR classification from paged actual sets across all locations. Performance time, original creation time, set order, and ID determine chronology. First-entry sets establish a baseline; subsequent badges are exclusive, with exact-weight prior evidence required for Rep PRs.
- Strength History defaults to All Time and retains server-side searching, counting, and pagination. Entry rendering no longer alphabetizes same-day workouts.
- Progress tables apply historical PR colors with an accessible achievement label and legend. Reps-only results render as reps in History cards and Progress charts/tables.
- Strength edits preserve unchanged performance timestamps, original set IDs, notes, and workout duration through quick editing.
- Bodyweight naming, compact paginated history, per-reading same-period/same-unit weekly comparisons, and two rolling comparison cards. Save/delete refresh the history page as well as chart data.
- Bodyweight edits preserve original units and unchanged timestamps. Numeric parsing occurs at the repository boundary; long chart histories load in batches. Charts separate units, use a numeric padded domain, exact reading tooltips, equal thin solid red/black lines, no persistent dots, and a legend.
- Shared tested numeric-domain utility; compact closed Chart Controls with the time selector outside the accordion. Bodyweight change chart domains include zero.
- Settings loading depends on account identity instead of token-refresh session objects, avoiding unnecessary application resets. Failed setup loading has a Retry button.

## Validation

224 tests passed across 46 files; lint and production build passed. Tests include chronology, badge exclusivity, reps-only PRs, numeric axes, weekly comparison isolation, and all navigation module combinations.

## Remaining validation and limitations

- No browser/device or authenticated live-account testing was performed. Verify navigation at 320, 375, 390, and 430px, keyboard/dialog interaction, expired-session recovery, and account switching before release.
- Bodyweight daily chart series retain the existing latest-reading-per-period/day selection. The history retains every reading. Multiple same-period readings on one day are not individually plotted.
- Weekly row comparisons require a matching local day seven days earlier within the loaded range; otherwise they show insufficient data. Loading a comparison buffer outside the visible range remains future work.
- The shared numeric domain is used broadly, but full metric-specific duration, distance, speed, and pace tick formatting remains unfinished.
- Location creation performs a normalized preflight check; concurrent creation still relies on existing database constraints. No new constraint or migration was introduced. The existing default-location RPC does not support clearing a default, so that control was not added.
- The supplied request ends midway through section 9 and contains no detailed authentication requirements beyond its title and priorities.
