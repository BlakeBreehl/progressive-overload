# Manual QA checklist

Test with production-like Supabase configuration before deployment.

- Mobile 375×812, tablet, and desktop: sign up, email confirmation, first login, refresh, sign out, returning login, slow network, and offline startup.
- Confirm the dumbbell/lightning mark on authentication, favicon, installed PWA, and common phone home screens.
- Settings: all four module toggles stay visible and update navigation immediately; manage Locations inline; open each activity-management destination; change preferred units.
- Strength: backdate a single-set lift, add multiple explicit sets, create an independent same-day entry, edit, delete through the modal, and verify Weight PR (green) and Rep PR (red) recalculation.
- Cardio: backdate, verify the three-column HH:MM:SS wheel with touch, mouse wheel, and keyboard, edit/delete, and verify weekly/monthly Progress totals.
- Flexibility: backdate Time and Reps entries; for multiple Time sets verify each has exactly two MM:SS columns, accepts 00:01–99:59, rejects 00:00, and restores saved values on edit.
- Bodyweight: add decimal Morning and Evening readings on historical dates, edit/delete, and verify graphs plus weekly/monthly change cards.
- Exercise, activity, Stretch, and location management: create, edit, dependency-safe delete, error, loading, and empty states.
- Progress: filters, individual Strength graph, actual-only monthly/yearly tables, Cardio aggregation, Flexibility charts, and Weight ranges.
- Selection controls: exercise/activity/stretch search filters correctly; short selects open above or below without clipping; arrows, Home/End, Enter/Space, Escape, focus return, disabled options, and multi-select check states work by keyboard and screen reader.
- Installed PWA: install, launch, refresh after a new build, offline shell, safe-area spacing, and recovery after reconnecting.
- Date ordering: enter the scrambled 2023–2025 regression dates; confirm Progress charts ascend and histories descend without a January 1 timezone shift.
- Histories: verify normalized search, No location, matching counts, 20-row paging, boundary buttons, reset-to-page-1 behavior, edit-removal, and last-page deletion.
- After manually applying migration 007: verify reps-only logging, weighted variants, Squat deduplication, safe rename conflicts, and preservation of legacy weighted bodyweight records.
- Server histories: create more than 20 matching rows, search for a page-two item, exercise Previous/Next boundaries, change every filter, and delete the only row on the last page while watching network requests for exact-count 20-row ranges.
- Exercise management: create and edit one exercise in each of the three logging modes; change a used exercise and confirm the warning, unchanged legacy history, cleared unsaved incompatible fields, and correct future logging UI.
- Chart controls: test every X preset, a local-date custom range, invalid dates, Auto Y padding, either custom Y bound, both bounds, negative change ranges, reset, phone accordion layout, and tooltip interaction across Strength, Cardio, Flexibility, Bodyweight, and both change charts.
- Bodyweight calendar analytics: test multiple same-day readings, Morning/Evening recomputation, Monday–Sunday and month/year boundaries, missing adjacent periods, partial current periods, zero previous average, and Weekly/Monthly change graph toggling.
