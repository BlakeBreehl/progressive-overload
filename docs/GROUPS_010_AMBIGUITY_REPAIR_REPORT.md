Migration 010 ambiguity repair is complete in source. No SQL was executed, no Supabase connection was made, and nothing was pushed or deployed. This follow-up preserves the previous recovery and announcement repair.

The exact 42702 collision was in $function_compatibility$: PL/pgSQL declared p record, while the later SQL query also aliased pg_catalog.pg_proc as p. PostgreSQL could resolve p.pronamespace as either a record field or an aliased table column. The record is now v_proc_row; the SQL alias is proc_row. The SELECT INTO and all record fields use v_proc_row. Every procedure-catalog column uses proc_row. Namespace, role and expected-signature columns are qualified as well. No variable_conflict override was used.

All six DO blocks and all twelve PL/pgSQL functions were audited, as were the SQL helper and generated crypto wrappers. These local names were standardized:

| Scope | Old local names | New local names |
| --- | --- | --- |
| preflight | r, obj, actual | v_expected_row, v_table_oid, v_column_row |
| function_compatibility | r, p | v_expected_row, v_proc_row |
| install_crypto | ns | v_crypto_namespace |
| constraints | r | v_expected_row |
| take_attempt | bucket, n | v_bucket, v_attempt_count |
| issue_code | alphabet, bytes, code, digest, secret, owner_id, retry, i | v_alphabet, v_bytes, v_code, v_digest, v_secret_row, v_owner_id, v_retry, v_byte_index |
| get_private_group_code | result | v_code |
| join_private_group_code | canonical, digest, invitation | v_canonical, v_digest, v_invitation_row |
| manage_private_group | v_group, v_target (table rows) | v_group_row, v_member_row |
| existing_groups | existing | v_group_row |
| effective_permissions | browser, obj | v_browser_role, v_object_row |

Existing scalar v_* variables and all p_* parameter names were retained. In particular, scalar v_group UUIDs in create/join remain scalars, distinct from manage's v_group_row record.

SQL aliases were also standardized throughout:

- Catalog/expected-state queries: p to proc_row; n to namespace_row; e to expected_row (or extension_row in crypto installation); a to attribute_row; d to default_row; c to catalog_row/class_row as appropriate; i to index_row; t to table_entry with an explicit table_name column.
- Catalog queries without aliases now use role_row, class_row, trigger_row, inheritance_row, rewrite_row, policy_row, attribute_row, constraint_row, index_row and timezone_row. Referenced catalog columns are qualified.
- Code validation/retrieval/backfill: c to code_row; g to group_row; i to invite_row; k/s to secret_row; p to privacy_row; u to user_row.
- Summary: m to member_row; p to privacy_row; s to set_row for Strength and session_row for Cardio; w to workout_row; e to exercise_row; a to activity_row.
- Previously implicit application reads/mutations now use group_row, member_row, invite_row, secret_row, request_row, release_row or privacy_row. The limiter INSERT uses attempt_row and RETURNING attempt_row.attempts.

No second definite variable/alias collision was found. The audit did identify generic locals and unqualified catalog/account/group reads that were future ambiguity risks; these are now explicit. INSERT column lists, SET assignment targets and ON CONFLICT column lists intentionally remain column names, as required by their SQL syntax. They cannot collide with the now v_* locals/p_* parameters. Single-source summary CTE fields have no same-named PL/pgSQL locals.

Preservation checks:

- One explicit BEGIN/COMMIT remains.
- Secret insertion still requires an empty secrets table; existing keys are not updated or replaced.
- Backfill still excludes current invitations and calls issue_code only for groups missing a mapping. A completed rerun does not rotate existing codes.
- Migration 008 is still required. Its existing authenticated SELECT/INSERT policies are accepted by preflight; the prior recovery repair's self-scoped announcement RPCs and final privilege rules are unchanged.
- get_release_acknowledgement(text) and acknowledge_release(text) remain, use auth.uid(), and retain idempotent ON CONFLICT DO NOTHING. No announcement client files were edited in this follow-up.
- Raw SHA-256 comparisons before/after confirm all nine migration 001-009 files are byte-for-byte unchanged. New regression tests also check recorded exact-byte hashes, permitting only standard LF/CRLF Git checkout forms.
- No schema/table/key/code/group/membership was dropped. No existing unrelated working-tree changes were removed.

Files changed in this follow-up:

1. supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql
2. src/features/groups/shortCodeMigration.test.ts (existing contracts updated for explicit aliases)
3. src/features/groups/migration010Recovery.test.ts (existing preservation contracts updated for explicit aliases)
4. src/features/groups/migration010Ambiguity.test.ts (new collision, naming, catalog qualification, transaction, 008/announcement and immutability contracts)
5. docs/GROUPS_010_AMBIGUITY_REPAIR_REPORT.md

Validation:

- Full suite: 77 files, 431 tests passed.
- Focused migration source contracts: 3 files, 31 tests passed (included in the full suite).
- Lint with --deny-warnings: passed, zero warnings.
- TypeScript checks: passed.
- Production build: passed.
- git diff --check: passed.
- No configured disposable PostgreSQL environment was found in the repository; psql, postgres and docker were not available on PATH. No database parsing/execution was performed. Source contracts detect the reported failure pattern but are not a PostgreSQL compiler or live RLS test.

Exact retry instructions (operator actions; not performed):

1. Confirm the intended Supabase project and original trusted migration role. If SQL Editor retains an aborted transaction, use its rollback control before starting a fresh query. Do not remove existing group_security objects or secrets.
2. Run the entire docs/GROUPS_010_PARTIAL_STATE_DIAGNOSTIC.sql in SQL Editor and retain its safe results. Confirm migration 008's ledger, migration 009 prerequisites, compatible owners/shapes and existing mapping state. Do not infer a completed migration from schema existence.
3. Open supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql from the current working tree. Paste and run the COMPLETE file in a fresh SQL Editor query, from its single BEGIN through its final COMMIT. Do not run only the corrected DO block or selected backfill fragments.
4. If any error occurs, stop, retain the safe error, and resolve the identified incompatibility. Do not skip checks or regenerate keys/codes.
5. After a successful commit, run the entire docs/GROUPS_010_VERIFY.sql. Require expected objects/constraints/RLS/grants, exactly one singleton, exactly one valid current mapping per group, no orphan/noncurrent active invitations, valid privacy values, and preserved baseline counts. Verify both announcement RPCs with an authenticated test account before deploying the client.

Rollback assessment:

The reported function_compatibility block precedes crypto installation, secret insertion, announcement privilege changes and invitation backfill. When the COMPLETE repaired 010 was submitted under its explicit BEGIN, 42702 aborts that transaction before application data-changing statements are reached; earlier schema/grant work in that same attempt cannot commit. An explicit transaction can remain aborted until the connection rolls back or ends it. Previously committed partial state remains untouched by rollback. The error alone does not establish how the SQL Editor submitted earlier attempts, so use the diagnostic instead of assuming the database is empty or fully migrated.

Remaining blockers are successful operator-run PostgreSQL execution, post-migration verification of the actual partial state, and the authenticated multi-account/PWA checks already listed in GROUPS_010_RECOVERY_REPORT.md. All requested local validation passes; no live migration or deployment is claimed.

READY TO RETRY MIGRATION 010
