# Progressive Overload: Cardio selector and PR history audit

Completed locally on October 29, 2026. Initial git status was clean.

## Root causes and behavior

The Cardio form already used the shared Combobox. The shared control rendered confirmed names as placeholders, retained selected IDs while typing, and styled its portal below the dismissal overlay. Cardio also remounted the selector whenever its activity ID changed, which would erase an invalidated search.

The shared control now renders the confirmed name as an input value in dark text, normalizes case and whitespace for matching, and keeps search separate from confirmation. Cardio clears its selected ID when typing and blocks Save until an option is explicitly selected. A status line identifies confirmed selection. Clicking or tapping an option and Arrow Up/Down + Enter select it; Escape and Tab close the menu without confirming typed text. Options stay outside sequential keyboard focus. Portal positioning remains viewport bounded, and its stacking layer now permits pointer interaction.

Existing-entry activities, including archived selected activities, preload visibly. Compatible metrics and entry identity remain intact. Switching between Steps and timed activities still requires confirmation before incompatible values are removed; Cancel restores the prior confirmed activity and metrics. Activity management remains available. No competing Cardio entry selector was found; the remaining activity-name input belongs to activity management.

PRs Over Time appears immediately after Strength Progress controls, before the main graph. Monthly is the default; Yearly aggregates the same evidence. The compact table scrolls horizontally inside its card and initially shows the most recent periods. It includes zero periods between the earliest and latest relevant entries. Weight PR counts are green, Rep PR counts blue, with text labels, table headers, a caption and keyboard-accessible scrolling.

Calculation uses strengthPrEvidence and detectRepetitionPrs on all rows from the existing 500-row batched Progress loader. It never uses the 20-row History page or summary records. The canonical classifier supplies exclusive historical event badges, normalized weight comparisons, assisted progression and reps-only rules. Event periods use local performance dates; date-only values remain calendar days. Classification precedes location filtering. The card clearly states that it covers all exercises and performance dates, and identifies the selected location. Exercise and graph date filters do not narrow this aggregate. New rows recalculate the table; navigating back to Progress remounts and reloads its data after creation, editing or deletion.

## Schema and data

No migration is needed. The existing activity IDs, tracking modes, metrics, strength sets and performance dates support both features. Existing migrations, repositories, RLS, ownership and group privacy were not changed. No SQL was applied, no deployment or push occurred, and no live Supabase data was read or mutated. Existing user records were not rewritten. .env and .env.local remain ignored and untracked. Dependencies and lockfile are unchanged.

## Validation

- Full Vitest suite: 607 / 607 tests passed across 99 files.
- PR aggregation tests also passed with TZ=America/New_York.
- Lint: passed without warnings.
- TypeScript: passed.
- Production build: passed.
- git diff --check: passed.
- No native select, alert, confirm or prompt introduced.
- Isolated Chromium fixture: passed at 320, 375, 390, 430, 768 and 1280 px. No horizontal page overflow. PR card height was approximately 269 px at 320 px, 233 px at 375/390/430 px.
- Browser coverage: normalized typed search, visible dark selection, portal hit testing, simulated touch/click selection, Arrow Up/Down and Enter, Escape, Tab without confirmation, stale-ID save rejection, Steps creation payload, timed/Steps switching and cancellation, existing-entry restoration and compatible edit persistence, monthly/yearly switching and latest-period scroll position.
- Unit coverage: monthly/yearly counts, zero periods, performance chronology independent of input order, exclusive events, first/tie/zero-rep exclusions, assisted and reps-only behavior, lb/kg normalization, local calendar boundaries, edit/delete recalculation, location scope, 1,001-row complete-history loading with account filtering and accessible table text.
- Dependency audit completed with existing advisories: vite (high), vitest (moderate), @vitest/mocker (moderate). These are development dependencies. The audit is not clean; no automatic dependency upgrades were made in this feature update.

To rerun browser checks, start `node tests/browser/serveNextUpdate.mjs`, then run `node tests/browser/runNextUpdate.mjs` in a separate terminal. The fixture uses in-memory repositories only.

## Exact changed files

- src/components/SelectionControls.tsx
- src/components/SelectionControls.test.ts
- src/features/cardio/CardioFeature.tsx
- src/features/progress/ProgressFeature.tsx
- src/features/progress/PrHistoryCard.tsx (new)
- src/features/progress/prHistory.ts (new)
- src/features/progress/prHistory.test.tsx (new)
- src/index.css
- tests/browser/entryEdit.jsx (selected-name assertion updated from placeholder to input value)
- tests/browser/strengthSteps.jsx (same assertion update)
- tests/browser/nextUpdate.jsx (new)
- tests/browser/serveNextUpdate.mjs (new)
- tests/browser/runNextUpdate.mjs (new)
- docs/next-update-audit.md (new)

## Remaining manual/authenticated QA

Authenticated Cardio creation/editing and real Supabase-backed PR reconciliation have not been run. Before considering deployment, use an authorized test account/environment to check Steps and timed entry saves, reload restoration, compatible activity edits, cancellation and errors, and PR totals after create/edit/delete against all historical sets. Verify account isolation and real-device touch, keyboard and screen-reader behavior, including Safari. No deployment-readiness claim is made.
