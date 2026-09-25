# Progressive Overload 2.1 ? entry-edit repair

## Scope and root cause

The initial workspace contained extensive uncommitted 2.1 work. This repair preserves that work.

Both Strength exercise pick handlers replaced entered sets with blank defaults. QuickLiftForm also cleared the selected definition while typing, losing the source definition needed for compatibility checks. Existing single-exercise workouts were routed through a quick serializer that represented distance data as one set. The general edit hydrator grouped nonconsecutive exercises, potentially changing interleaved set order.

Cardio's selector already updated its draft functionally. Its save handler nevertheless discarded metrics based on the activity name and regenerated the performance timestamp using the current clock time. Its success-screen draft also needed the actual saved timestamp for subsequent edits.

Existing Strength edits now use the complete workout form. Search text and pending selection are separate from the committed definition. Stable block and set keys survive selection changes; functional updates address rows by identity. Repeated definitions retain their original consecutive blocks. Original set-order numbers are preserved when the existing rows remain in order; explicit additions/duplicates/reordering still receive valid unique orders. There are no selection-dependent route changes, component keys or draft reinitialization effects in this edit path.

## Preservation and conversion rules

- Strength same-schema changes preserve all rows, workout/set IDs, numeric values and units, notes, load, duration, performance timestamp, location (including No location), and existing order. Metadata not written by the RPC, including creation timestamps, remains untouched.
- Compatibility uses trackingType, loadMode and progressionDirection. Reps-only names are not used to classify conversions.
- Lifted weight ? assistance weight requires a styled confirmation explaining the new meaning; values remain unchanged.
- Weight/Reps ? Reps Only requires confirmation and removes weight only.
- Repetitions ? Distance/Laps requires confirmation and removes weight and reps only. Required destination values must be entered before saving.
- Distance/Laps ? Repetitions requires confirmation and removes distance, unit and laps only. Load and duration remain stored and editable because the schema permits them. Reps and required weight must be entered before saving.
- Cancel, Escape and dismissal of the dialog retain the original definition and values. Failures retain the edited form. No native popup controls are used.
- Cardio changes retain every supported metric, steps, duration, notes, units, location and performance time. Populated uncommon metrics remain visible and editable. Serialization is independent of activity-name defaults. Distance and unit remain paired as required by the schema; explicitly clearing distance clears its unit. Legacy recorded laps are loaded, displayed and serialized.
- Saving targets the same existing record; neither repository falls back to insertion when an update fails. PR badges and Progress membership use freshly loaded exercise IDs and dynamic calculations, not stored PR badges.
- Browser refresh does not persist unsaved drafts: it reloads saved history without writing or duplicating entries. Actual page reload is covered with a persisted, isolated mock repository; authenticated route navigation remains a manual gate.

## Database decision

No migration 012 is necessary. The current save_strength_workout RPC from migration 009 updates exercise_id and tracking_type on owned existing set IDs and updates the owned workout ID. It leaves creation timestamps and unsubmitted metadata intact. The schema requires repetition rows to omit distance/unit/laps and distance rows to omit weight/reps; optional load and duration remain valid across types. The Cardio schema permits optional metrics regardless of activity, and its existing repository uses an ID-scoped update.

Migrations 001?011 were only read. Their file hashes match the initial workspace snapshot. Migration 011 was not edited or rerun. No SQL was executed, no Supabase connection was made, no live data changed, and nothing was deployed or pushed. Announcement copy, release ID, acknowledgement and dismissal behavior are unchanged by this repair.

## Exact files changed by this repair

1. src/features/strength/StrengthFeature.tsx
2. src/features/strength/QuickLiftForm.tsx
3. src/features/strength/repository.ts
4. src/features/strength/exerciseChange.ts (new)
5. src/features/strength/exerciseChange.test.ts (new)
6. src/features/cardio/CardioFeature.tsx
7. src/features/cardio/DurationWheel.test.ts
8. src/features/cardio/entryDraft.ts (new)
9. src/features/cardio/entryDraft.test.ts (new)
10. tests/browser/entryEdit.jsx (new)
11. tests/browser/serveEntryEdit.mjs (new)
12. docs/ENTRY_EDIT_21_QA.md (new)
13. docs/entry-edit-browser-results.json (new)
14. src/features/cardio/repository.ts

Migrations, Progress code, release announcement, dependency manifests, service worker and all other prior work were left intact.

## Automated validation

- Complete Vitest suite: 84 files, 497 tests pass.
- oxlint --deny-warnings: passes, zero warnings.
- TypeScript: npm run typecheck passes; final production build also runs tsc -b.
- Production build: passes.
- git diff --check: passes. Git reports existing Windows LF/CRLF conversion notices, not whitespace errors.
- npm audit --json: zero vulnerabilities across 188 dependencies. The restricted attempt could not reach the advisory endpoint; the approved registry-only retry succeeded. No dependencies changed.
- Local Chromium browser fixture: 48 checks passed at both 390?844 and 1280?900 (96 checks total), including success-screen timestamps and actual refresh during both edit forms.
- Browser scenarios cover compatible/incompatible changes, dialog cancellation and confirmation, stable rendered rows, single/multiple sets, assistance semantics, distance preservation, failure retention, update targets/no duplicates, rapid changes, recent and page-two entries, same-screen native Back, form Cancel, actual reload, and Cardio success-screen timestamp retention.
- PR/Progress reassignment is covered by automated calculation tests; actual authenticated charts remain manual QA.
- No native select, alert, confirm or prompt was introduced in product code. The duration-wheel test still contains its existing assertion forbidding a native select.
- Actual .env files remain ignored and untracked; only the existing .env.example template is tracked. No credentials or service-role keys were added.

To rerun the isolated browser checks, start node tests/browser/serveEntryEdit.mjs, then run node tests/browser/runFocusedRelease.mjs with FOCUSED_WIDTH=390 and FOCUSED_HEIGHT=844 (repeat at 1280?900). It uses only in-memory fixture records and a local-only connection policy.

## Exact authenticated manual QA sequence (not executed)

Use the intended test account on the approved QA environment. Do not execute SQL. Inspect IDs, timestamps and request bodies using authenticated browser Network responses. Repeat on actual iOS Safari and Android Chrome, including installed mode where supported.

1. Sign in and verify startup reaches the app. Open Strength History, record the workout ID, set IDs/order, performed_at, created_at, location, notes, duration and complete set values for a Shoulder Press entry with three distinct sets. Include different weights/reps and per-set notes. Note another unrelated entry as a control.
2. Open that workout ? Edit workout. Search Military Press, select it, and verify all three rows and details remain. Save changes. Inspect the single save_strength_workout call: same workout/set IDs, same order/timestamp/metadata, new exercise ID. Reload history; verify exactly one workout, unchanged chronology and unchanged control entry.
3. Repeat with a single-set workout and with an older workout reached using Next on history pagination. Repeat once with No location while a default gym exists, and once with an explicit gym.
4. Change Assisted Pull Up ? Assisted Chin Up. Verify assistance/reps remain without a dialog. Change a weighted exercise ? Assisted Dip; verify the meaning-change dialog, cancel once, then repeat and confirm. All weight and rep values must remain.
5. Change Weight/Reps ? Reps Only. Before confirmation verify every old value remains. Cancel, then test Escape/backdrop dismissal. Repeat and confirm: only weight disappears, every rep/set/note/duration remains. Save and reopen. Repeat Pull Up ? Chin Up without interruption.
6. Change Sled Push ? Yoke Carry with several distance sets. Verify and save every distance, unit, lap count, load, duration and note. Test Distance ? Weight/Reps and the reverse: cancel first, then confirm, inspect exactly the fields described in the dialog, enter required new fields, and save. Preserved load/duration must remain editable.
7. Rapidly switch several compatible exercises before saving. Verify the final selection and every row value. Block the save request in DevTools while keeping the page online, attempt Save, and verify the complete form remains. Unblock and retry; verify the same IDs and no duplicate workout.
8. Navigate to Progress for the original and destination exercises. Verify the changed sets moved to the destination, aggregate graphs and PR badges recalculate from chronology, and the control workout remains unchanged.
9. In Cardio, record an existing Running entry ID, created_at, performed_at, duration, distance/unit, steps, recorded laps, speed, incline, resistance, notes and location. Edit ? Treadmill ? StairMaster. All populated metrics must remain visible, editable and unchanged. Save; inspect an update of the same ID with all metrics and the original timestamp. Verify count and chronology are unchanged.
10. Repeat Cardio with the older entry on page two, No location and an explicit gym. Switch activities rapidly. Block saving, verify every value remains, unblock and retry. Verify steps exactly and no insert/duplicate.
11. After a Cardio save, use Edit Entry from the success screen. Change only activity, wait several seconds, save and verify performed_at remains the previously saved value. Also intentionally change the date, save, re-edit from success, then change activity and verify that newly saved timestamp remains exact.
12. For both modules, change selection without saving and press Cancel; reopen and verify persisted values. Repeat using browser Back to leave the module and return; verify no write occurred. Repeat with page refresh during editing: unsaved values are discarded, persisted IDs/data reload, and no record is inserted. Repeat after a successful save to verify the saved change survives reload.
13. Confirm release-announcement acknowledgement and dismissal persistence still behave normally. Record real-device findings separately from fixture results.

## Remaining release gates

The production startup issue remains a separate unresolved gate. Authenticated RPC/RLS behavior, real-device interactions, actual application route Back navigation, and authenticated PR/Progress rendering still require the sequence above. Local build and fixture success do not establish full deployment readiness.
