# Progressive Overload 2.4 — local release finalization

Migration 014 was successfully applied according to the operator. This pass did not connect to Supabase, execute SQL, deploy, push, or mutate live data. Migrations 001–014 are frozen and their SHA-256 hashes were compared before/after this pass. No migration 015 was created. This report describes local implementation and validation, not authenticated production certification.

## Drop-set completion audit and repairs

The audit found two omissions, repaired before completing the announcement:

1. A confirmed change from a nested repetition entry to Distance/Laps removed children from the draft by omitting `dropSets`. The existing RPC interprets an omitted key as preserve, so saving the changed parent could fail its child repetition constraint. `changeExercise` now retains explicit `dropSets: []` when clearing an existing nested group. The atomic payload sends `drop_sets: []`. No database migration or existing data rewrite is needed. Regression coverage checks the payload and that the original workout is not mutated.
2. The Strength home recent-PR summary inspected only main IDs. It now includes main and drop performance IDs, so a qualifying drop PR appears in the summary without increasing any set-volume count. The browser lifecycle fixture records a main Weight PR plus a drop Rep PR and verifies two recent PR marks.

| Requirement | Audit evidence |
| --- | --- |
| Compact Add Drop Set beside Duplicate/Remove; blank child fields; multiple children; child Duplicate/Remove; final removal clears Main Set | `SetRow` uses stable IDs and functional updates; six-width browser checks exercise all controls and predictable focus. |
| Main-group duplication and stable typing/removal | Recursive duplication gives every copied row a fresh client ID; browser rapid-edit/removal and complete-group duplication checks pass. |
| Weighted, reps-only, assistance, zero reps; no distance drops | Existing field modes and canonical validation retained; unit/browser tests cover each. Confirmed incompatible changes explicitly clear children. |
| Create, failed save, success-screen Edit Entry, history restoration, compatible edits and IDs | Production `StrengthFeature` browser fixture uses account-local mock repository/RPC results through the real save/parser adapters. It checks failure retention, complete success display, Edit Entry, repeated saves with stable IDs, History and history editing. |
| History and performance/PR graphs | Nested history and success rows show real child values/badges. Graph adapters expand actual performances; canonical PR tests retain exclusivity, chronology, assistance, reps-only and zero-attempt rules. |
| Main-only totals everywhere | Main table remains source for counts. `isCountableMainSet` is shared by `countSetGroups`/Your Sets/Home donut, `setTrend`/Sets by Muscle Group and weekly/monthly buckets, exercise usage/recorded counts and progress usage sorting. Time-period counts and muscle totals are tested. Workout history/exact pagination counts remain outer entries. Monthly/yearly performance and PR tables expand children only for performance classification. |
| Group/friend set totals and ownership/RLS | Applied 014 source retains main-only set CTE and a separate child-inclusive PR source. Composite ownership FK, RLS policies and invoker save RPC remain unchanged and source-contract tested. No live RLS request was made. |
| Legacy ordinary workouts | Existing adapters continue to return one ordinary main row per old set; no Main Set label appears without drops. Existing zero-rep eligibility remains unchanged. |

## Announcement and one-time persistence

Release ID: **`progressive-overload-2.4-drop-sets`**.

The current App mounts `DropSetsAnnouncement`, titled **Progressive Overload 2.4**, with the **Drop Sets Have Arrived** headline and **Got It — Let’s Lift** primary action. Copy explains Add Drop Set, Main Set, lighter follow-up children, duplicate/remove controls, History/performance/PR inclusion, and one main-group set in totals and muscle-group statistics. No optional secondary route/action was added. The existing Settings **What’s New** action intentionally reviews the current release; it does not affect automatic one-time eligibility.

The existing 2.3 local-first acknowledgement logic was extracted into `createAccountRelease` and reused by both 2.3 and 2.4. Earlier identities, local keys and server records are unchanged. The existing post-010 RPCs accept an arbitrary release ID of 1–100 characters, with a `(user_id, release_id)` key and account ownership derived from `auth.uid()`. Consequently no SQL or new migration is required for 2.4.

The local key is `<release ID>:<account ID>`, with `pending` or `synced` values. Dismissal records `pending` synchronously, closes immediately and dispatches an account/release-scoped notification before awaiting the server. A failure retains local suppression. Transient failures get bounded retries; pending synchronization is retried on ready-account mount, online/visibility recovery, and every 30 seconds while visible/online. Server synchronization changes the value to `synced`. A second device without the local key consults the existing server acknowledgement and suppresses the popup after synchronization. Captured account tokens prevent a later account switch from redirecting a request to another account. Pending reads and writes are deduplicated per client/account/release; stale responses and late observers cannot reopen a dismissed announcement.

Rendering alone does not acknowledge. The component mounts only after authenticated account/bootstrap/onboarding readiness, is excluded from auth/recovery routes and is not reached on setup failure. Account-keyed instances, cleanup, a presented guard, a dismissal ref, scoped storage events and Strict Mode tests prevent accidental reopening. The established ConfirmDialog provides focus trapping, Escape/overlay dismissal and safe-area spacing. Its 2.4-only layout keeps the primary action visible at 320 px while long copy scrolls inside the dialog; there is no horizontal overflow.

## Validation and limits

- Full suite: **684/684 tests passed**.
- Focused announcement and drop-set checks: **59/59 passed** across five files, including earlier 2.3 persistence regression tests.
- Lint, TypeScript, production build and `git diff --check`: passed.
- Announcement browser checks: Chromium at **320, 375, 390, 430, 768, 1280 px**, no failed assertions. Includes Strict Mode, repeated renders, local-first failure, background recovery, refresh/remount/PWA/sign-in persistence, account switching, server acknowledgement with missing local cache, stale reads, native keyboard focus trapping, Escape and overlay dismissal, visible 44px primary target and no horizontal overflow.
- Drop-set browser checks at the same six widths: no failed assertions, including the full production feature lifecycle with a mock account database.
- Dependency audit completed: **3 existing development-tool findings** (Vite high; Vitest and its mocker moderate). Dependency files/versions were not changed.
- Native select/popup and changed-source credential pattern scans: no matches. Pattern scans are not a complete secret inventory.
- Migration hash comparison: **001–014 unchanged**, no 015.

Browser tests use isolated Chromium profiles and local fixtures/mocked RPCs, not real account data or physical iOS/Android devices. Server persistence, live ownership/RLS and authenticated create/edit/delete still require separate authorized verification. The reported successful migration application was supplied by the operator and was not independently queried. Nothing was deployed or pushed, and no live acknowledgement or workout data was written.

Reproduce: `npm test`, focused `npx vitest run src/lib/dropSetsRelease.test.ts src/lib/strengthTrendsRelease.test.ts src/components/DropSetsAnnouncement.test.tsx src/features/strength/dropSets.test.tsx src/features/strength/exerciseChange.test.ts`, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`, `npm audit --json`. Browser servers: `node tests/browser/serveRelease24.mjs` and `node tests/browser/serveDropSets.mjs`; then run their corresponding `runRelease24.mjs` and `runDropSets.mjs` runners.

## Exact files changed in this finalization pass

- `src/App.tsx`
- `src/components/DropSetsAnnouncement.tsx`
- `src/components/DropSetsAnnouncement.test.tsx`
- `src/lib/accountRelease.ts`
- `src/lib/strengthTrendsRelease.ts`
- `src/lib/dropSetsRelease.ts`
- `src/lib/dropSetsRelease.test.ts`
- `src/index.css`
- `src/features/strength/StrengthFeature.tsx`
- `src/features/strength/exerciseChange.ts`
- `src/features/strength/dropSets.test.tsx`
- `tests/browser/dropSets.jsx`
- `tests/browser/release24.jsx`
- `tests/browser/serveRelease24.mjs`
- `tests/browser/runRelease24.mjs`
- `docs/NESTED_DROP_SETS_014_REVIEW.md`
- `docs/RELEASE24_FINALIZATION.md`
- `docs/release24-tests.json`
- `docs/release24-announcement-browser-results.json`
- `docs/release24-drop-set-browser-results.json`
- `docs/release24-dependency-audit.json`
- `docs/release24-validation.json`
- `docs/release24-screenshots/announcement-1280.png`
- `docs/release24-screenshots/announcement-320.png`
- `docs/release24-screenshots/announcement-375.png`
- `docs/release24-screenshots/announcement-390.png`
- `docs/release24-screenshots/announcement-430.png`
- `docs/release24-screenshots/announcement-768.png`
- `docs/release24-screenshots/strength-1280.png`
- `docs/release24-screenshots/strength-320.png`
- `docs/release24-screenshots/strength-375.png`
- `docs/release24-screenshots/strength-390.png`
- `docs/release24-screenshots/strength-430.png`
- `docs/release24-screenshots/strength-768.png`
