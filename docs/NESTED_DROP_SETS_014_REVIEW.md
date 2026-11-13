# Nested Strength drop sets — migration 014 review and manual QA

Status update for 2.4: the operator confirms migration 014 was successfully applied. Migrations 001–014 are now immutable; do not rerun the historical recovery procedure below. See `RELEASE24_FINALIZATION.md` for the current local release audit. The agent has not applied SQL or independently queried the live schema. Earlier recovery and validation notes below are historical.

## Assessment and design

The applied schema through 013 stores independent ordinary sets with one workout-level order. It has no unambiguous parent/drop relationship. Inferring drops from existing order, weight changes, or notes would reinterpret user data. Therefore 014 creates `strength_drop_sets`; existing `strength_sets` remain main sets, with their values and IDs unchanged.

A composite FK from `(parent_set_id,user_id,workout_id,exercise_id,tracking_type)` to the main table guarantees the same owner/workout/exercise and repetition tracking. Children reference only the main table, so chains and cycles are impossible. Positive unique `(parent_set_id,drop_order)` and cascade deletion enforce grouping and order. Reps permit zero; weights must be finite and nonnegative; a trigger enforces weighted versus reps-only storage. All four CRUD policies enforce `auth.uid()` ownership. The save RPC remains security-invoker and checks supplied child IDs against their original owned parent before replacing rows transactionally. Existing child IDs survive edits. Missing `drop_sets` preserves children for older callers; explicit `[]` removes them. Duplicate main IDs or child IDs abort the entire call. Existing two-argument callers remain supported.

The repaired migration validates catalogs before changing schema inside one atomic server-side DO statement, with an independent final postflight DO. It has no temporary/session-local preservation objects and never invokes the saved RPCs during installation. Read-only pre/post aggregates replace snapshot assertions. Migrations 001–013 are untouched. No existing row is converted into a drop.

## Count audit

Canonical client rule: `src/features/strength/dropSets.ts:isCountableMainSet`. Main rows remain the source collection; `strengthPerformances` and `performances` are explicit expansion boundaries for performance consumers.

| Location | Result |
| --- | --- |
| `setBreakdown.ts:countSetGroups`, `summarizeSetPeriod` | Your Sets totals and muscle split count main rows only; all-time, month, three/six/twelve month filters retain existing calendar rules. PR totals expand children separately. |
| `YourSets.tsx` used by Strength and `App.tsx` Home | Both use the same breakdown adapter; donut/pie totals exclude drops. |
| `setTrend.ts` / `SetsByMuscleGroup.tsx` | Weekly/monthly buckets, six weeks, three/six months, year and all-time count eligible main rows only, including zero-filled periods. |
| `exerciseSummary.ts` / `ExerciseSetCountSummary.tsx` / exercise library | Recorded-set and usage counts exclude drops; best/last performance may inspect them. |
| `progress/repository.ts:strengthExerciseUsage` and default exercise sorting | Counts only eligible main rows even if passed expanded performance rows. |
| `StrengthFeature.tsx` history/delete preview/detail/success and `WorkoutCard.tsx` | `.sets.length` remains number of main groups; nested drops never become outer history cards. |
| `repository.ts:getStrengthHistoryPage` exact count | Counts workouts, not performances; search and pagination retain entry boundaries. |
| `private_group_summary` SQL in 014 | Set-count CTE still joins only `strength_sets`, preserving group/friend sets and muscle totals. PR source alone unions drops. `groups/logic.ts` and `GroupsFeature.tsx` consume these aggregates. |
| `progress/ProgressFeature.tsx` monthly/yearly performance tables | These are best-performance tables, not set-volume tables; expanded drops participate as performances. PR monthly/yearly tables use canonical classification. |
| SQL migrations 001–013 | Audited `strength_sets` and `count(*)` references; immutable historical definitions remain unchanged. Latest active summary (013) is replaced in 014, preserving Steps and privacy behavior. |

Existing completed-set eligibility is preserved: a zero-rep attempt does not count or earn badges. Adding drops does not increase set totals; a main zero-rep attempt does not become a completed set because a drop succeeds.

## PR, graphs and history

`detectRepetitionPrs` is still the exclusive canonical classifier. It expands nested performances and orders by performance date, workout creation chronology, main order, drop order, and stable ID. Weight PR wins over Rep PR; First Entry is separate; zero reps earn no badge. Weighted, reps-only and assisted lower-is-better comparison behavior is retained. The group SQL mirrors this pipeline with main/drop chronology and canonical kg comparisons while preserving group membership/privacy checks.

All Logged Sets, Rep Weight and One Rep Max receive actual eligible drop performances through the same performance adapter. Existing zero-attempt exclusions and assisted One Rep Max restrictions remain. All Logged Sets marker descriptions identify Drop Set N. PRs Over Time and Your Sets PR totals classify the full history before filtering dates/locations. No synthetic PR is awarded for merely adding a child. Best/last exercise summaries identify a selected drop performance as Drop Set N.

History, detail and save confirmation render one main group with subordinate drop rows and their individual badges. Ordinary single sets have no Main Set/Set 1 heading. Editing and deleting operate on the existing workout; cascade deletion handles children. The active editor is `WorkoutForm`; legacy quick conversion preserves nested values and `isQuickWorkout` routes nested workouts away from the old quick editor.

## Partial-state recovery and execution model

014 has not completed cleanly. The reported SQL Editor execution committed earlier DDL but failed after losing session-local preservation objects. The observed drop table and trigger must be treated as existing database objects, not rolled-back work. No supporting frontend has been deployed. This repaired 014 intentionally supports a clean post-013 database, the reported partial state, and a compatible completed 014 database. Do not create 015 or rerun 001–013.

The file now contains two complete server-side `DO` statements. The first performs read-only prerequisite checks, locks the affected schema tables for that statement, audits every existing 014 object in a preflight pass, installs only missing compatible schema, replaces the three intended function definitions/known trigger and normalizes ACLs, then validates the result before returning. All changes in that first DO are atomic, even when the editor executes separate top-level statements on separate connections. The final DO independently repeats the schema and security assertions. There are no temporary tables, persistent helper validators, session variables, or cross-statement preservation objects. PL/pgSQL variables live only within their own server statement. There is deliberately no outer BEGIN/COMMIT dependency.

A compatible populated `strength_drop_sets` is retained without row writes. An empty incomplete table can receive missing columns. A populated table with missing columns, conflicting type/nullability/default/generated status, unexpected extra columns, an incompatible named constraint/index/policy, or an incompatible function signature stops recovery with a clear exception. Required key columns are checked in order; ownership FK targets and delete/update cascades are checked. Check expressions are checked with cast/format normalization plus Boolean-tree topology. The four known authenticated owner policies are validated and retained or created if missing. Unrelated policies are never dropped; ones that could widen public/anon access or defeat ownership cause an exception for review. The known trigger is dropped and immediately recreated inside the atomic DO; functions use CREATE OR REPLACE. ACL normalization removes table and column grants to PUBLIC/anon/authenticated and grants authenticated only CRUD; only the two user-facing RPCs receive EXECUTE. The trigger function has no PUBLIC/anon/authenticated EXECUTE grant.

No installation statement updates/deletes/inserts existing Strength workouts, main sets or drops. Row-changing SQL exists only inside the stored save RPC definition and is not invoked by migration. Adding/validating constraints may scan rows and acquire locks, but does not rewrite values or IDs. No automatic preservation claim is based on session state: compare the following read-only aggregates before and after, with application writes paused.

## Exact read-only current-state checks — operator only

These queries were not run by the agent. Run in the intended project, save output privately, and inspect the migration ledger separately; a ledger entry or successful individual statement does not establish full 014 completion.

```sql
-- Clean state: drop_table is null. Reported partial/complete state: it exists.
select to_regclass('public.strength_drop_sets') as drop_table,
       to_regclass('public.strength_drop_user_parent_idx') as drop_index;

-- Every existing column, including type modifiers, nullability, defaults and generated/identity status.
select a.attname,format_type(a.atttypid,a.atttypmod) as column_type,a.attnotnull,
       a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid=to_regclass('public.strength_drop_sets') and a.attnum>0 and not a.attisdropped
order by a.attnum;

select c.conrelid::regclass as table_name,c.conname,c.contype,c.convalidated,
       c.condeferrable,c.condeferred,c.conkey,c.confkey,pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where (c.conrelid=to_regclass('public.strength_sets') and c.conname='strength_main_drop_owner_key')
   or c.conrelid=to_regclass('public.strength_drop_sets')
order by c.conrelid::regclass::text,c.conname;

select c.oid::regclass as index_name,i.indisvalid,i.indisready,i.indisunique,
       pg_get_indexdef(i.indexrelid) as definition
from pg_class c join pg_index i on i.indexrelid=c.oid
where c.oid=to_regclass('public.strength_drop_user_parent_idx');

select c.oid::regclass as table_name,c.relkind,c.relpersistence,c.relrowsecurity,
       c.relforcerowsecurity,c.relowner::regrole as owner
from pg_class c where c.oid in (to_regclass('public.strength_sets'),
  to_regclass('public.strength_workouts'),to_regclass('public.strength_drop_sets'));
select policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='strength_drop_sets' order by policyname;
select tgname,tgenabled,pg_get_triggerdef(oid) as definition from pg_trigger
where tgrelid=to_regclass('public.strength_drop_sets') and not tgisinternal order by tgname;

select requested.signature,p.oid::regprocedure as actual_signature,p.prorettype::regtype as result,
       p.prosecdef,p.proconfig,p.proowner::regrole as owner,p.proacl,
       pg_get_functiondef(p.oid) as definition
from (values ('public.enforce_strength_drop_load_mode()'),
             ('public.save_strength_workout(jsonb,jsonb)'),
             ('public.private_group_summary(uuid,text,text,text)')) requested(signature)
left join pg_proc p on p.oid=to_regprocedure(requested.signature);

-- ACLs include PUBLIC (grantee=0); also inspect column ACLs, not just table grants.
select c.relname,a.* from pg_class c,
  lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
where c.oid=to_regclass('public.strength_drop_sets');
select c.attname,a.* from pg_attribute c,lateral aclexplode(c.attacl) a
where c.attrelid=to_regclass('public.strength_drop_sets') and c.attnum>0 and not c.attisdropped;
```

Expected partial-state output may already contain the table, trigger, constraints, index, policies and updated functions. Their presence is acceptable; compatibility matters. Preserve existing child rows. If an unexpected definition is found, do not drop objects or edit data to force the migration through. The preflight will identify the conflict without modifying schema.

## Exact read-only pre/post Strength aggregates

Pause application writes for the comparison window. Back up using the normal secure project procedure. Execute this identical query before the full-file rerun and after both DO statements complete. Save results outside the repository; compare every cell per table and user, including both row-hash sums. Each query uses one statement snapshot; no connection continuity is required.

```sql
with row_evidence as (
  select 'strength_workouts'::text as table_name,w.user_id,w.id,md5(to_jsonb(w)::text) as row_hash
  from public.strength_workouts w
  union all
  select 'strength_sets',s.user_id,s.id,md5(to_jsonb(s)::text)
  from public.strength_sets s
)
select table_name,user_id,count(*) as row_count,count(distinct id) as distinct_ids,
       min(id::text) as first_id,max(id::text) as last_id,
       sum((('x'||substr(row_hash,1,16))::bit(64)::bigint)::numeric) as hash_sum_a,
       sum((('x'||substr(row_hash,17,16))::bit(64)::bigint)::numeric) as hash_sum_b
from row_evidence group by table_name,user_id order by table_name,user_id;
```

The fingerprints incorporate every old column and ID, including timestamps/notes, and avoid row-order dependence or a giant string aggregation. They are an aggregate integrity check, not a mathematical proof of identical rows; retain the secure backup for exact forensic comparison. Add a simple global count query so empty-table results are visible:

```sql
select (select count(*) from public.strength_workouts) as workout_count,
       (select count(*) from public.strength_sets) as main_set_count;
```

When the drop table exists before rerunning (as in the reported state), also execute this identical optional query before and after. In a clean state with no drop table, skip its preflight invocation and expect a newly created empty drop table after installation.

```sql
with row_evidence as (
  select user_id,id,md5(to_jsonb(d)::text) as row_hash from public.strength_drop_sets d
)
select user_id,count(*) as drop_count,count(distinct id) as distinct_ids,
       sum((('x'||substr(row_hash,1,16))::bit(64)::bigint)::numeric) as hash_sum_a,
       sum((('x'||substr(row_hash,17,16))::bit(64)::bigint)::numeric) as hash_sum_b
from row_evidence group by user_id order by user_id;
select count(*) as drop_count_including_empty from public.strength_drop_sets;
```

## Exact full-file rerun procedure — manual only

1. Confirm the intended project and the known partial state with the read-only checks above. Keep frontend deployment on hold. Save backups, existing RPC definitions and the preflight aggregates privately. Check for independent production hotfixes before replacing the RPC definitions.
2. Stop writes for the aggregate comparison window. If the SQL Editor reports an aborted transaction, its operator must issue ROLLBACK for that session; do not assume it undoes already committed statements or removes the existing table.
3. Open the repaired `supabase/migrations/202611130014_nested_strength_drop_sets.sql`. Select the **entire file**, including both complete dollar-quoted DO statements. Run it once in the SQL Editor as the privileged migration operator. Do not run interior fragments, add wrapper snapshots, invoke the save RPC, run old migration versions, create 015, or rerun 001–013.
4. Wait for completion of both statements with no exceptions. Each DO emits `Migration 014 postflight passed: columns, constraints, index, RLS, policies, trigger, functions and privileges verified`. The first DO rolls back all of its own changes on error. If only its changes commit and the independent final check fails, retain the objects/data and investigate; repeating the corrected complete file is safe for compatible objects.
5. Run the current-state checks and identical Strength aggregate queries again. Every original Strength workout/set aggregate and, if applicable, drop aggregate must match. A mismatch needs investigation before any frontend release; do not overwrite or delete data to reconcile it.
6. The final `DO $postflight_014$ ... $postflight_014$;` can also be run independently as a read-only schema/security verifier. Mark 014 complete through the project's normal migration-ledger procedure only after both DO statements, aggregate comparisons and current-state inspections succeed. SQL Editor execution alone may not update the CLI migration ledger.

## What establishes schema completion

Both DO statements finish without errors; the final notice is emitted; all 11 required columns and their exact compatible types/nullability/defaults exist; the parent unique key and eight child constraints are validated with correct ordered keys and cascades; the user/parent btree index is valid and ready; RLS is enabled; four known authenticated owner policies exist with exact gates; the trigger is the enabled BEFORE INSERT OR UPDATE row trigger calling the intended function; all three signatures/security modes/search paths exist; authenticated has CRUD and the two RPC EXECUTEs without grant options; PUBLIC/anon has no table/column/function access. Required schema assertions are repeated in the independent final DO. Unrelated policies are not removed. Pre/post data aggregates must also match. A compatible completed database can rerun the whole file without changing rows or duplicating schema objects.

After schema completion, authenticated staging create/edit/delete, cross-account RLS, atomic failure and leaderboard checks below are still required before deployment readiness. No SQL application, Supabase connection, deployment, push or live-data mutation was performed by the agent.

## Exact authenticated manual QA — staging test accounts only

1. Sign in as account A with legacy multi-set workouts and shared group membership with account B. Record baseline Home/Your Sets, muscle totals, exercise usage, period tables, group sets, and PR counts. Open a legacy workout; verify all values and IDs match the backup.
2. At 320/375/390/430 px and desktop, log a weighted main 225 lb × 8; add drops 185 × 10 and 135 × 12. New fields must be blank before typing. Tab through each control; press Enter on Add Drop Set, Duplicate and Remove. Confirm focus moves to the new row, and removal returns focus to Add Drop Set. Check no horizontal page overflow.
3. Duplicate a drop, remove the middle drop and verify sequential labels and unchanged surviving values. Remove all drops and verify Main Set disappears. Re-add two drops; duplicate the main and verify both complete groups have independent IDs. Remove the duplicate main and verify only its children disappear.
4. Save. Inspect the authenticated network request: exactly one `save_strength_workout` RPC with nested `drop_sets`. Verify the saved workout has one main and two children, positive distinct drop orders and matching owner/workout/exercise. Check save confirmation, Edit Entry, history and reopening after refresh restore exact IDs, units and values.
5. Change to a compatible named exercise and save/reopen; values must remain. Change to reps-only via the modern dialog: remove weights and retain reps in every row. Change to Distance/Laps: the dialog names all nested drops and incompatible repetition fields; cancel preserves them; confirm removes drops and hides Add Drop Set. Repeat with assisted exercises and zero reps.
6. Simulate network/server failure after editing multiple children. Save failure must retain every field. Restore connectivity and retry; ensure no duplicate workout or partial rows. Test a rejected invalid child in staging: the entire RPC, including parent edits, must roll back.
7. Create later-dated and backdated performances including drops that independently qualify for Weight PR, same-weight Rep PR, reps-only Rep PR, and reduced-assistance PR. Verify exclusive badges in history and matching PRs Over Time/group totals. First Entry and zero-rep attempts must have no PR. All Logged Sets must include eligible drop points with their actual values and Drop Set labels.
8. Compare baseline totals: one main plus multiple drops adds exactly one completed set to Home/Your Sets, muscle totals, each applicable period, exercise recorded counts and group/friend sets. Three main groups add three. Add/remove a child on an existing main: set totals stay fixed while PR/performance results may change.
9. As account B using B's authenticated session (never service-role), attempt SELECT/INSERT/UPDATE/DELETE against A's children and the save RPC with A's parent/child IDs. Reads must return no rows; writes must fail or affect zero rows. Attempt wrong workout/exercise, duplicate/zero/negative drop order, distance parent, and a child ID as parent; constraints must reject all.
10. Delete A's test workout through the app confirmation. Check all its main/drop rows disappear, B's records and legacy workouts remain unchanged, and every chart/leaderboard refreshes correctly. Test history search/pagination with many workouts and confirm one entry is never split into drop cards.

## Failure / recovery

Never assume a failed full-file run removed committed objects. The first repaired DO is atomic; prior partial objects remain if its preflight rejects a conflict. The standalone postflight has no writes. Keep existing tables and data, preserve the exception/current-state output, and resolve a schema conflict through review before rerunning the same repaired 014. Do not drop/truncate/recreate a populated drop table, disable ownership checks, or rerun applied migrations. If independent hotfixes conflict with the expected definitions, reconcile them in source before retrying. Use the secure preflight backup for forensic comparison rather than destructive rollback.

## Local validation and limits

See `drop-sets-tests.json`, `drop-sets-browser-results.json`, `drop-sets-dependency-audit.json` and `drop-sets-screenshots/`. Tests use local fixtures/mocks and migration source contracts; no authenticated Supabase or live SQL validation was performed. Browser coverage is Chromium with mobile viewport emulation, not physical iOS/Android or a screen-reader session. ARIA group labels, native button keyboard activation, 44px targets, focus and overflow are checked locally.

The dependency audit found 3 existing development-tool vulnerabilities: Vite high, Vitest moderate and its mocker moderate. No dependency versions were changed. Full tests, lint, TypeScript, production build, diff whitespace, native select/popup scan and credential scan results are recorded in the final work report. Deployment readiness requires independent 014 review/application and passing the authenticated steps above.

## Exact changed files

- `docs/NESTED_DROP_SETS_014_REVIEW.md`
- `docs/drop-sets-browser-results.json`
- `docs/drop-sets-dependency-audit.json`
- `docs/drop-sets-screenshots/screen-1280.png`
- `docs/drop-sets-screenshots/screen-320.png`
- `docs/drop-sets-screenshots/screen-375.png`
- `docs/drop-sets-screenshots/screen-390.png`
- `docs/drop-sets-screenshots/screen-430.png`
- `docs/drop-sets-screenshots/screen-768.png`
- `docs/drop-sets-source-audit.json`
- `docs/drop-sets-tests.json`
- `docs/drop-sets-migration014-recovery-results.json`
- `src/features/strength/dropSets.test.tsx`
- `src/features/strength/migration014.test.ts`
- `src/features/strength/dropSets.ts`
- `supabase/migrations/202611130014_nested_strength_drop_sets.sql`
- `tests/browser/dropSets.jsx`
- `tests/browser/runDropSets.mjs`
- `tests/browser/serveDropSets.mjs`
- `src/features/progress/ProgressFeature.tsx`
- `src/features/progress/prHistory.ts`
- `src/features/progress/repository.ts`
- `src/features/progress/strengthModes.ts`
- `src/features/strength/QuickLiftForm.tsx`
- `src/features/strength/StrengthFeature.tsx`
- `src/features/strength/WorkoutCard.tsx`
- `src/features/strength/exerciseChange.ts`
- `src/features/strength/exerciseSummary.ts`
- `src/features/strength/logic.ts`
- `src/features/strength/quickLog.ts`
- `src/features/strength/repository.ts`
- `src/features/strength/searchMetadata.ts`
- `src/features/strength/setBreakdown.ts`
- `src/features/strength/setTrend.ts`
- `src/features/strength/types.ts`
- `src/index.css`

## Recorded final checks

- Full Vitest suite: 662/662 tests passed; no failures. Includes 13 drop-set feature tests and 40 migration-014 source/formatting regression tests.
- Lint: clean, no warnings.
- TypeScript: passed.
- Production build: passed.
- Browser matrix: Chromium 320, 375, 390, 430, 768 and 1280 px, no failed assertions; screenshots retained. Native Enter activation, stable rapid edits, 44px actions, focus, nested form restoration and no page overflow verified.
- `git diff --check`: passed.
- Source scan: no credential candidates in changed text files, no native selects or alert/confirm/prompt calls in changed production source; full `src` scan also found none. This is pattern-based scanning, not a credential inventory.
- Dependency audit: completed with 3 pre-existing development-tool findings (1 high, 2 moderate); details in JSON.
- Migration recovery: focused migration suite 116/116 passed across 12 files. 014 is repaired for clean/compatible partial/completed states; its production schema is reported partially committed, not independently inspected. No SQL, Supabase connection, authenticated DB tests, deployment, push or live-data mutation was performed by the agent.

Reproduce locally: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`, `npm audit --json`; browser: start `node tests/browser/serveDropSets.mjs`, then run `node tests/browser/runDropSets.mjs`.


## This recovery repair: exact changed files and limits

- `supabase/migrations/202611130014_nested_strength_drop_sets.sql`: in-place resumable schema recovery and independent postflight, no session preservation objects.
- `src/features/strength/migration014.test.ts`: 40 recovery source/formatting regression tests; no SQL execution.
- `src/features/strength/dropSets.test.tsx`: obsolete snapshot contracts removed; 13 feature tests retained.
- `docs/NESTED_DROP_SETS_014_REVIEW.md`: current partial-state runbook, read-only queries, aggregates and completion criteria.
- `docs/drop-sets-tests.json`: refreshed full-suite results.
- `docs/drop-sets-migration014-recovery-results.json`: recovery validation summary.

The repaired complete file is prepared for a manual rerun from the reported partial state when existing definitions match its compatibility checks. This is source validation, not proof of live PostgreSQL execution: no database was contacted and no SQL was applied. A conflicting object intentionally stops recovery. Do not interpret this as frontend deployment readiness; authenticated QA and schema completion remain required. The earlier Chromium artifacts remain evidence for the unchanged frontend and were not rerun for this schema-only repair.

## Reps-check cast-format repair

Both the installation validator and independent postflight now recognize the reported upper-bound rendering `('9007199254740991'::bigint)::numeric`. The normalization folds only that exact literal's lossless bigint/int8 cast (including pg_catalog qualification), rather than stripping bigint casts from arbitrary expressions. A cast on the reps column is still rejected because it could round fractional values; changed bounds/operators, weakened whole-number checks and altered finite-value exclusions are rejected. Ordinary whitespace in accepted cast formatting is normalized consistently. No existing constraint is dropped or recreated to bypass comparison.

Both actual and expected Boolean operator sequences are now aggregated with explicit ordinality. Tests prove that the weighted-check regrouping whose parentheses-free text is identical is still rejected by its different Boolean tree, and that OR/NOT variants of the reps check fail. The two validation blocks have identical normalization code. Regression fixtures execute the string transformations extracted from the checked-in SQL through a portable JavaScript regex adapter; they do not execute PostgreSQL.

Latest validation: 662/662 full tests, 116 focused migration tests across 12 files, clean lint, TypeScript, production build and git diff --check. The complete file is prepared for manual rerun from the compatible reported partial state; live PostgreSQL execution remains unverified. No SQL, Supabase connection, deployment, push or live-data mutation was performed. Applied migrations 001-013 remain unchanged; no 015 was created.
