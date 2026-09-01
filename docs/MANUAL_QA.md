# Manual QA checklist

Test with production-like Supabase configuration before deployment.

## Release-blocking sequence

Do not deploy until every item below passes. Run SQL manually in the target Supabase project; the application must never run migrations.

1. **Capture pre-migration aggregates.** Save the result of:
   ```sql
   select count(*) set_count,
          count(weight) weighted_rows,
          count(reps) rep_rows,
          coalesce(sum(weight),0) stored_weight_total,
          coalesce(sum(reps),0) stored_rep_total
   from public.strength_sets;
   ```
2. **Check normalized conflicts.** Review, but do not automatically merge or delete, every row returned by:
   ```sql
   select user_id, lower(regexp_replace(trim(name),'\s+',' ','g')) normalized, count(*)
   from public.exercises
   group by 1,2 having count(*) > 1;
   ```
   Specifically review `Squat`, `Dumbbell Bench`, and `Dumbbell Bench Press` for each account.
3. **Apply migration 007 completely.** Back up the database, confirm migrations 001â€“006 are recorded, then run the complete `202609010007_strength_load_modes_and_catalog.sql` file once in Supabase SQL Editor. Do not paste fragments and do not continue after an error.
4. **Perform post-migration verification.** Re-run the aggregate query from step 1 and require every count and sum to match. Run the trigger, column/constraint, catalog, duplicate, and index verification queries in `docs/STRENGTH_CATALOG_V2.md`; require exactly one intended trigger on each target table.
5. **Strength exact-value test.** Log `52.5 lb Ã— 12` and `55 lb Ã— 3`, including a third set containing 12 reps. Confirm the form, success screen, edit restoration, History, Progress, and database rows preserve the exact weight, reps, and set order.
6. **Pull Up test.** Confirm Pull Up is Reps Only, has no Weight input, and preserves 12 reps through save/edit/history/Progress.
7. **Weighted Pull Up test.** Confirm it is a separate Weight + Reps exercise and never shares history with Pull Up.
8. **Sled Push test.** Log load, decimal distance, laps, and optional duration; edit it from success and verify every value and distance unit.
9. **Timer tests.** Confirm Cardio `01:02:03` stores/reloads as 3,723 seconds and Stretch `01:12` stores/reloads as 72 seconds. Confirm Stretch has only MM:SS and rejects 00:00.
10. **Bodyweight test.** Save/edit/delete a `175.6` Morning reading and a distinct Evening reading. Verify daily averages, Mondayâ€“Sunday weeks, calendar months, absolute/percentage changes, missing days, and partial periods.
11. **Most-used Strength graph.** Create a known set-count winner and ties; verify count, most-recent-performance, and normalized-name ordering. Manually choose another exercise and change all chart controls without losing it.
12. **Responsive layouts.** Complete the core add/edit/delete flows at 375px phone width, tablet width, and desktop width. Check dropdown layering, dialogs, search, pagination, wheels, and chart controls.
13. **Authentication.** Test a brand-new account and a returning account: confirmation redirect, first login without refresh, sign-out, sign-in again, slow companion-row creation, and permanent RLS/schema error presentation.
14. **Netlify variables.** Configure only `VITE_SUPABASE_URL=https://<project-ref>.supabase.co` and `VITE_SUPABASE_ANON_KEY=<browser-safe publishable/anon key>` for the Production context. Never configure a service-role key. Redeploy after changing variables.
15. **Supabase URL configuration.** Set **Site URL** to the exact production origin, for example `https://<site>.netlify.app`. Add exact allowed redirects for the production root and auth return routes used by the app; add deploy-preview/local URLs only when intentionally tested. Do not use an unrestricted production wildcard.
16. **Installed-PWA smoke test.** Install from production, verify the dumbbell/lightning artwork, launch standalone, refresh a direct route, test the offline shell, reconnect, and verify Supabase/auth responses were not served from cache.
17. **Final production smoke test.** Under two separate accounts, add, edit from success by returned ID, view, and delete one record in each module. Confirm the other account cannot read or affect it. Recheck the last-item-on-last-page behavior.

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
