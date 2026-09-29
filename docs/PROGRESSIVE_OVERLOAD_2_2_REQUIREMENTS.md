Implement Progressive Overload 2.2 as a focused mobile-first usability update.

Migration 011 has already been applied successfully. Do not edit or rerun migrations 001–011. Do not deploy, push, execute SQL, connect to Supabase, or modify live records.

Begin by inspecting git status and the current diff. Preserve all completed 2.1 work, especially:

- Cardio steps
- Assisted-exercise progression direction
- Dip categorization
- Entry-edit preservation
- Groups and leaderboards
- Server-backed release acknowledgements
- Authentication/startup improvements
- Existing historical multi-exercise workouts

Audit each requirement below before editing, determine the root cause or current implementation, and then complete it.

## 1. One exercise per new Strength entry

Remove every “Add Another Exercise” or “Add Exercise” action from the normal new Strength-entry workflow.

A newly created Strength entry should contain:

- One exercise
- One or more sets of that same exercise
- Date
- Optional location
- Collapsible notes

Users must still be able to:

- Add Set
- Remove Set
- Duplicate Set
- Reorder sets if that currently exists
- Log multiple sets for the selected exercise
- Save the entry
- Cancel without saving

Do not remove the ability to add multiple sets. Only remove the ability to put multiple different exercises into one newly created entry.

After saving, remove “Log Another Exercise” from the success screen. The success screen should instead offer:

- Edit Entry
- View Strength History
- Done / Return to Strength

The user can begin another entry from the Strength landing screen.

Historical compatibility:

- Do not alter or split existing multi-exercise workouts.
- Existing complex workouts must remain readable and editable.
- Preserve the legacy multi-exercise editor only when opening a historical workout that already contains multiple exercises.
- A one-exercise historical entry should use the streamlined editor.
- Never delete or rewrite existing data to fit the new UI.

Ensure a newly created Strength entry can never accidentally submit multiple exercise IDs.

## 2. Put “Add a new location” inside the Location dropdown

Remove the separate location-creation button/field from Strength and Cardio entry forms.

The existing searchable Location combobox should contain an action at the bottom such as:

`+ Add new location`

Requirements:

- It should appear inside the open dropdown/listbox.
- It must remain visible or easily reachable when the location search has no matches.
- Selecting it should open a polished inline dialog or compact creation panel.
- It must not be implemented as a fake location record or ordinary selectable option.
- The user enters the location name, saves it, and the new location becomes permanently available.
- Immediately select the newly created location for the current entry.
- Preserve every other unsaved form value while creating the location.
- Normalize whitespace and perform the existing case-insensitive duplicate check.
- If a matching location already exists, select the existing location and explain that it was already available.
- If creation fails, retain the form and location name and show a retryable inline error.
- Allow Cancel without changing the current selection.
- Support “No location.”
- Respect account ownership and RLS.
- Use the same reusable behavior in Strength and Cardio rather than maintaining two inconsistent implementations.
- Keep location management in Settings as well.

Keyboard and accessibility requirements:

- Arrow-key navigation
- Enter/Space activation
- Escape closes the appropriate layer
- Focus returns to the Location control
- Screen-reader label for the creation action
- At least 44px touch targets
- No native `<select>`, `prompt`, `alert`, or `confirm`

## 3. Bottom navigation must always return to module home

Every bottom-navigation icon must navigate to the main landing screen for that module, even when the user is already somewhere inside that module.

Examples:

- From `/strength/new`, tapping Strength goes to `/strength`.
- From a Strength history detail or edit screen, tapping Strength goes to `/strength`.
- From `/cardio/new` or Cardio edit/history, tapping Cardio goes to `/cardio`.
- Apply the same behavior to Flexibility, Bodyweight, Progress, and Groups.
- Tapping Home always goes to the Home dashboard.

This must work even when:

- The selected navigation item is already considered active.
- A nested route is open.
- A form-success screen is open.
- A dialog was previously opened.
- Browser history contains the same module route.
- A module component remains mounted.
- The PWA is resumed from the background.

Expected behavior:

- Clear or reset transient module subview state.
- Close module-specific dialogs and dropdowns.
- Exit creation/edit/success/detail modes.
- Return scroll position to the top of the module landing screen.
- Do not delete saved or unsaved data silently.

Unsaved-form protection:

- If navigating away would discard unsaved changes, show the existing modern confirmation dialog.
- Allow Stay or Discard and Go to Module Home.
- Do not use a native browser confirmation.
- If the form is unchanged, navigate immediately.

Trace whether the existing bug is caused by:

- Ignoring navigation to the already-active tab
- Local state controlling subviews independently from the URL
- Routes that do not remount or reset
- Click handlers returning early
- Browser history deduplication
- Success/edit state surviving navigation

Fix the underlying routing/state issue and add tests for every module and nested route.

## 4. Collapsible notes

Set notes and exercise/workout notes should not consume permanent space.

For each optional notes area:

- Initially show one compact row with a chevron and clear label.
- Examples:
  - `Exercise notes`
  - `Set notes`
- Tapping the row expands the text field directly below it.
- Tapping again collapses it.
- Existing note text must never be erased when collapsed.
- When editing an entry with an existing note, automatically start that specific notes section expanded.
- If multiple sets exist, each set’s notes control must operate independently.
- Adding, removing, duplicating, or reordering sets must not move notes to another set.
- Stable set identities must be used rather than array indexes.
- Duplicating a set should duplicate its note only if other set values are also duplicated.
- Removing a set removes only that set’s unsaved note.
- Notes remain included in save payloads while collapsed.
- Failed saves retain the notes.
- Use an animated but restrained chevron/accordion.
- Include `aria-expanded`, `aria-controls`, visible focus, and accessible labels.
- Do not display an empty notes textbox until expanded.

Use consistent wording across new entry, compatible historical editing, and the advanced legacy editor.

## 5. Redesign the saved-entry confirmation screen

The Strength save-success screen is currently too small. Redesign it as a prominent mobile-first success view that occupies most of the available content area.

It should show:

- A clear success icon/visual
- “Lift Logged” or similarly concise heading
- Exercise name
- Date
- Location, or No location
- Every set in order
- Correct presentation for Weight + Reps, Reps Only, Assisted Weight + Reps, and Distance/Laps
- Weight PR, Rep PR, and First Entry badges where actually applicable
- A clear “Attempt” treatment for zero-rep sets
- Edit Entry
- View Strength History
- Done / Return to Strength

It must not show:

- “Log Another Exercise”
- `undefined`
- Fabricated zero weight
- “Set 1” for a one-set entry
- PR badges for unsuccessful attempts
- Estimated strength or estimated 1RM

For multiple sets, show numbered sets. For one set, omit unnecessary set numbering.

Design requirements:

- Fill most of the usable screen without overflowing horizontally.
- Polished white/red/black styling consistent with the app.
- Strong visual hierarchy.
- Comfortable phone spacing.
- Action buttons large enough for touch.
- Responsive on 320, 375, 390, and 430px widths.
- Account for iPhone safe areas and installed-PWA viewport height.
- Preserve the returned database entry ID so Edit Entry opens the exact saved entry.
- A refresh must not accidentally resubmit the entry.

If Cardio, Flexibility, or Bodyweight use the same undersized shared success component, improve the shared layout safely, but do not remove module-specific fields or actions.

## 6. Allow zero-rep unsuccessful attempts

Allow users to save `0` reps for repetition-based Strength exercises. This represents an attempted lift that was not completed.

Examples:

- Bench Press: 300 lb × 0 reps
- Assisted Pull Up: 25 lb assistance × 0 reps
- Pull Up: 0 reps

Validation:

- Reps must be a whole number greater than or equal to zero.
- Reject negative reps.
- Reject fractional reps.
- Reject blank reps.
- Reject nonnumeric values.
- Retain current weight requirements:
  - Weight + Reps requires a valid nonnegative weight.
  - Assisted exercises require valid nonnegative assistance.
  - Reps Only does not fabricate a weight.
- Distance exercises remain unaffected.

Display:

- Show zero-rep records clearly as unsuccessful attempts.
- Prefer wording such as `300 lb attempt — 0 reps` or an `Attempt` label.
- Do not imply that the weight was successfully lifted.
- Preserve attempts in Strength History and entry details.
- Allow editing and deletion normally.
- Ensure search and pagination include them.
- Do not display `undefined × 0`.

PR and statistics rules:

A zero-rep set must never count as:

- First Entry
- Weight PR
- Rep PR
- One Rep Max
- Rep Weight milestone
- All Logged Sets performance point
- Monthly or yearly best lift
- Successful set count
- Sets by Muscle Group totals
- “Your Sets” totals
- Group/leaderboard set totals
- Group/leaderboard PR totals
- Most-used-exercise successful-set count
- Last successful weight/reps subtitle

A zero-rep attempt may appear in a dedicated history tooltip/list, but it must not alter successful performance trends.

Important chronology rule:

- PR calculations must completely ignore zero-rep attempts as performance evidence.
- If the first chronological record is 300 × 0 and a later record is 225 × 5, the later successful record is the true First Entry/baseline.
- If 300 × 0 is followed by a successful 300 × 1, the successful lift may be a Weight PR based only on earlier successful records.
- An attempted assisted lift must not establish a lower-is-better Weight PR.
- Editing a successful record to zero reps must dynamically remove its PR/statistical contribution.
- Editing an attempt to positive reps must dynamically add it to chronology and recalculate later records.

“All Logged Sets” naming notwithstanding, it should remain a successful-performance graph unless a clearly separate “Show attempts” control is intentionally added. Do not mix zero-rep attempts into the performance line by default.

Database requirements:

Inspect all existing repetition constraints and validation functions, including migrations 002, 007, 011, `save_strength_workout`, trigger functions, and any RPC validation.

Because migrations 001–011 are already applied:

- Do not edit them.
- Create a forward-only migration only if the current database rejects zero reps.
- If needed, name it:
  `supabase/migrations/202609290012_zero_rep_attempts.sql`
- Wrap it in `BEGIN`/`COMMIT`.
- Replace only the necessary positive-rep constraints/checks with nonnegative whole-number validation.
- Update affected functions/triggers with `CREATE OR REPLACE`.
- Preserve RLS, grants, ownership checks, `SECURITY DEFINER` protections, and safe search paths.
- Do not weaken validation for weights, distance, duration, laps, or other modules.
- Do not rewrite existing records.
- Make it safe for the known state where 001–011 are applied.
- Include read-only preflight and post-migration verification queries.
- Do not execute it.

Audit every client and SQL consumer of `reps > 0`, truthiness checks such as `if (reps)`, `Math.max`, and filters that may accidentally treat zero as missing or valid performance.

## 7. Remove Workout Duration from Strength

Remove overall Workout Duration from all active Strength forms, quick logging, historical single- and multi-exercise editing, details, confirmation, History/search results, Progress/tooltips, validation and help text. Preserve optional per-set distance/lap duration, Cardio duration and timed Flexibility duration.

Keep historical overall duration unchanged through edits; new entries submit null to the existing RPC. Retain database columns and repository round-trip metadata. No migration or historical data rewrite is required.

Regression coverage must verify hidden overall duration across Strength screens, neutral new repetition/distance saves, retained distance-set and other-module controls, and unchanged historical duration across single/quick/multi-exercise edits and subsequent saves.

## 8. Progressive Overload 2.2 announcement

Add a polished one-time announcement after all 2.2 features are complete.

Use the existing server-backed release acknowledgement system.

Stable release ID:

`progressive-overload-2.2-launch`

Requirements:

- Do not alter or reuse the 2.0 or 2.1 release IDs.
- Show it once per authenticated account.
- Do not show it until account bootstrap is ready.
- On dismissal, await the server acknowledgement.
- Prevent repeated submissions.
- If acknowledgement fails, show an inline retry option.
- Do not silently fall back to session-only or in-memory persistence for authenticated users.
- It must remain dismissed across refresh, sign-out/sign-in, PWA close/reopen, token refresh, different devices, and later deployments.
- Account A’s dismissal must not affect Account B.
- Do not create new acknowledgement schema if migration 010 already supports arbitrary release IDs.

Announcement copy should briefly highlight:

- Cleaner single-exercise logging
- Location creation inside the selector
- Reliable module navigation
- Collapsible notes
- Improved logged-entry confirmation
- Unsuccessful lift-attempt tracking

Make it more exciting than an ordinary dialog while remaining readable, accessible, and responsive.

## 9. Regression tests

Add focused tests proving:

1. New Strength entries accept only one exercise but multiple sets.
2. Historical multi-exercise workouts remain intact and editable.
3. No “Add Another Exercise” appears on new-entry or success screens.
4. Location creation inside the dropdown preserves the entire unsaved form.
5. Duplicate locations select the existing record.
6. Failed location creation retains input and form data.
7. Every bottom-navigation icon returns from new/edit/detail/success screens to its module home.
8. Unsaved changes trigger the modern confirmation dialog.
9. Notes collapse without being erased.
10. Existing notes start expanded during editing.
11. Multiple set notes remain attached to stable set IDs.
12. Success view renders all Strength tracking modes correctly.
13. Zero reps save and reload exactly as zero.
14. Negative, fractional, blank, and invalid reps are rejected.
15. Zero-rep attempts receive no First Entry, Weight PR, or Rep PR.
16. Attempts do not affect normal or assisted progression.
17. Attempts do not affect graphs, summaries, muscle totals, or leaderboards.
18. The first later successful lift establishes the baseline correctly.
19. Editing between zero and positive reps recalculates achievements.
20. The 2.2 announcement is account-scoped and durably acknowledged.
21. Previous 2.0 and 2.1 acknowledgements remain independent.
22. iPhone/Android navigation and success layouts do not overflow.

## 10. Release validation

Run:

- Complete test suite
- Lint with zero warnings
- TypeScript checks
- Production build
- `git diff --check`
- Dependency audit
- Mobile/browser layout checks at 320, 375, 390, and 430px
- Desktop checks
- Search for native `<select>`, `alert`, `confirm`, and `prompt`
- Search for `undefined`, `NaN`, and unsafe truthiness handling of zero reps
- Confirm `.env` and `.env.local` remain ignored and untracked
- Confirm no service-role key or real credential exists
- Confirm service-worker caching still excludes Supabase/auth/API traffic

At completion, report:

1. Audit and confirmed root causes.
2. Exact files changed.
3. Whether migration 012 was required.
4. Exact migration 012 application and verification sequence, if created.
5. Zero-rep rules across every affected screen/statistic.
6. Automated validation results.
7. Authenticated two-account and real-device QA checklist.
8. Genuine unresolved blockers.
9. Confirmation that migrations 001–011 were not changed or rerun, no SQL was executed, no live data changed, and nothing was deployed or pushed.

Do not claim deployment readiness until any required migration 012 is applied and authenticated real-device QA passes.

End with exactly:

READY FOR PROGRESSIVE OVERLOAD 2.2 REVIEW