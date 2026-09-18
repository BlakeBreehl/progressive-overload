Migration 010 recovery and announcement repair are prepared for review. No SQL was executed, no live data was accessed or mutated, and nothing was pushed or deployed. Existing unrelated working-tree changes were preserved.

1. Reported schema failure and unknown state

ERROR 42P06 proves group_security already existed when the original unconditional CREATE SCHEMA ran. Migration 009 does not create it. Its provenance cannot be established from this error: an earlier committed/partial execution or manual creation is possible. The failing invocation could not proceed beyond that first DDL statement; that does not establish what earlier executions persisted. Neither rollback nor completed migration 010 is assumed.

An earlier prefix could contain the schema; four pgcrypto wrappers; secrets table and singleton; codes, attempts, creation_requests and privacy tables; helper and public functions; modified summary/manage functions; changed grants/RLS; retired invitations; and backfilled current codes. Each original DO/function/table statement is atomic, but no assumption is made that a user ran the complete transaction as one unit. The diagnostic inventories the actual state.

2. Recovery behavior

010 retains one BEGIN/COMMIT. It checks schema/table/function ownership, exact columns/defaults/nullability, constraints, unexpected policies/indexes/triggers/rules/inheritance, function signatures/return contracts, and current mapping compatibility. Conditional creation reuses prefix objects. Missing expected constraints and backing indexes are added; conflicting objects stop recovery. Missing columns in an existing table are treated as incompatible rather than guessing how to populate private data; original CREATE TABLE prefix statements create complete shapes atomically.

The migration locks recovery tables and group/invitation writes and serializes concurrent recovery attempts. An incompatible state raises an object-specific error and rolls back this attempt. Owners must match the migration role; use the original trusted migration/admin role. No schema, key, group, membership, workout, or preference is dropped or reset.

A compatible singleton is retained byte-for-byte. An empty secrets table receives one new row only if there are no existing code mappings. Multiple/invalid secrets or mappings without original secrets stop recovery. Existing ciphertext is checked internally against its original key/HMAC, with only a boolean result and sanitized errors; no key, plaintext, ciphertext or hash is emitted.

Current mapping/invitation ownership, validity, capacity and encryption compatibility are checked before backfill. Retirement excludes every currently referenced invitation. Only groups missing a mapping call issue_code. Thus a completed rerun skips secret creation, code issuance and already retired invitations, and changes no stored application record values. Explicit user-requested Replace still rotates codes normally. Privacy rows are never backfilled or updated; absence still means sharing enabled.

Security-definer functions retain an empty protected search_path and migration ownership. Browser table/helper grants are revoked, RLS is enabled, legacy create/join execution is revoked, and only reviewed public entry points receive authenticated execution. Effective permission checks also catch inherited privileges.

3. Announcement root cause and persistence

The fixed release ID was already stable: progressive-overload-2.0-launch. Migration 008 already provides release_announcements(user_id, release_id, seen_at), with a composite primary key, auth.users FK, RLS and self-only policies. The old client marked a sessionStorage/in-memory flag before saving, swallowed save errors, and interpreted failed reads as no acknowledgement. Reopening a browser/PWA removed that fallback; a missing server acknowledgement then displayed the popup again. This is a demonstrated client failure path; the specific production database/network error remains unknown without diagnostic results.

A real browser regression also reproduced a MutationObserver race: removing the dialog could trigger its observer to reopen it before React effect cleanup. Each display request now permits only one presentation.

The repaired client uses the existing ledger through two small self-scoped RPCs in 010: get_release_acknowledgement(text) and acknowledge_release(text). Neither accepts a user ID. Saves use auth.uid() and ON CONFLICT DO NOTHING, preserving existing timestamps. Direct browser ledger grants are revoked; existing rows remain. No migration 011 or duplicate ledger is created.

The server is authoritative on every fresh mount. localStorage is only a per-account/per-release cross-document notification after successful persistence; sessionStorage is not used. Identity/readiness gates mount the component, pending reads do not display it, failed reads have Retry, and failed saves keep it open with Retry dismissal. Sign-out/unready state unmounts memory; account changes remount independently. An in-flight lookup cannot override a concurrent dismissal. Navigation after completion waits for successful persistence. Settings > What's New intentionally remains available. No development reset existed, and none was introduced.

PWA/browser storage separation and service-worker updates cannot override a server acknowledgement. The existing worker excludes auth/API/Supabase traffic and was not changed by this task. Existing account bootstrap and account keys were already correct and were preserved.

4. Files changed by this task

- supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql
- docs/GROUPS_010_PARTIAL_STATE_DIAGNOSTIC.sql
- docs/GROUPS_010_VERIFY.sql
- docs/GROUPS_010_RECOVERY_REPORT.md
- docs/announcement-recovery-browser-results.json
- docs/groups-010-regression-browser-results.json
- src/components/ReleaseAnnouncement.tsx
- src/lib/releaseAnnouncement.ts
- src/lib/releaseAnnouncement.test.ts
- src/domain/launchContract.test.ts
- src/features/groups/migration010Recovery.test.ts
- tests/browser/announcementRecovery.jsx
- tests/browser/serveAnnouncementRecovery.mjs
- tests/browser/runAnnouncementRecovery.mjs

Migrations 001-009 were compared with HEAD and remain unchanged. Other files already modified/untracked at task start were not edited by this task.

5. Validation and limits

- Full Vitest suite: 76 files, 415 tests passed. Announcement coverage expanded from 3 to 16 tests; 6 recovery source-contract tests added; launch contract updated.
- Announcement browser fixture: 24 assertions in each of four Chromium-emulated Android/iOS browser/standalone modes, 96 passed. Exercises actual React lifecycle, slow/failing reads, failed/retried saves, remounts, account switching, navigation, manual reopening, and real cross-document storage events. The server is mocked. Cold start/token-refresh/route cases are lifecycle simulations, not authenticated production sessions.
- Existing Groups/mobile/progress browser fixture: 1,381 assertions per mode, 5,524 passed at 390x844 across the same four modes. Covers group creation/name focus, short codes, management, join/privacy and mobile/progress controls. These are Chromium emulations, not physical iPhone/Android certification.
- Lint with --deny-warnings: passed, zero warnings. TypeScript: passed. Production build: passed. git diff --check: passed.
- npm audit: completed after explicit network disclosure approval; zero vulnerabilities (188 reported dependencies).
- Source checks: no announcement sessionStorage, runtime-generated release IDs or reset mechanism; no production native alert/confirm/prompt calls, detected service-role key assignments or private code/key logging. Only .env.example is tracked, no real .env file.
- Existing regression suite covers eight-character code generation, owner-only visibility, Copy/Share/Replace/Join, server-side privacy exclusion, group isolation, startup recovery, password recovery, progress widths and service-worker contracts.
- SQL was inspected and source-tested only, never parsed/executed by a PostgreSQL server. Prefix compatibility and idempotence require authorized database validation before deployment. Tests do not prove live RLS or historical row preservation.

To reproduce the announcement browser tests, start node tests/browser/serveAnnouncementRecovery.mjs in one terminal. In another PowerShell terminal set $env:FOCUSED_SINGLE='1'; $env:MOBILE_MATRIX='1'; then run node tests/browser/runAnnouncementRecovery.mjs. These use a fresh isolated Chrome profile and local fixtures only.

6. Exact operator recovery sequence (not performed)

1. Use the intended Supabase project and the trusted role that owns migrations 008/009 (normally postgres in SQL Editor). Arrange a quiet write window and retain a private database backup/snapshot if value-level preservation must be demonstrated. Never paste secrets or private records into a review.
2. Open docs/GROUPS_010_PARTIAL_STATE_DIAGNOSTIC.sql. Run the entire file in SQL Editor as read-only statements. Save every safe result set locally, especially group/member/activity/privacy/acknowledgement counts. Do not run only the object-creation fragment of 010.
3. Interpret absent prefix objects as potentially expected. Null safe_counts means a required relation/column is missing, not zero. Compare shapes/owners/defaults/constraints with 010. A present schema alone is not success or corruption. Zero secrets is acceptable only with zero codes; one valid singleton is expected with mappings. More than one singleton, orphan mappings, incompatible current invitations, unexpected policies/owners/objects or invalid preferences require investigation before proceeding. Legacy/noncurrent active invitations may exist before recovery; original raw token length cannot be inferred from its hash, so the diagnostic safely reports all active noncurrent invitations instead. Migration 008's ledger must exist and match its contract.
4. After reviewing the diagnostic, paste the COMPLETE repaired supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql into a fresh SQL Editor query, from BEGIN through COMMIT, and run once as a complete batch. Do not remove guards or skip errors. If a guard fails, the attempt must roll back; preserve the safe object-specific error and investigate. If the editor retains a failed transaction, end that transaction using its rollback control before opening a new attempt. Never delete the schema, regenerate keys, or rerun isolated backfill statements to get past a failure.
5. Open docs/GROUPS_010_VERIFY.sql and run the entire read-only file. Require all expected objects/constraints/indexes present and valid; RLS on all six tables; exactly one singleton; group count equal to mapping count; zero missing/orphan/incompatible mappings; zero active noncurrent invitations; valid privacy/accounts; protected function paths/owners; no PUBLIC/anon execution on reviewed RPCs; authenticated execution only on intended public RPCs; no browser private-schema/table/helper access; and legacy create/join execution revoked. is_group_member(uuid) retains its intended authenticated access from 009.
6. Compare saved group/member/activity/privacy/ledger counts. In a quiet window they must match. Counts cannot prove unchanged values or detect balanced insertion/deletion: compare trusted snapshots privately if stronger proof is required. Neither diagnostic claims to prove historical non-rewrites from post-state alone. Automatic data-changing statements in 010 touch only missing secret/code/invitation state and legacy invitation retirement; membership/personal-data mutations exist only inside explicitly invoked application RPC definitions.
7. Before approving deployment, perform an authorized isolated-database prefix/rerun exercise: test the original file's statement boundaries plus the repaired complete rerun; privately compare existing secrets, ciphertext, hashes, invitation values, memberships and preferences. This was not run because all SQL execution was prohibited. Then deploy the client only after the two announcement RPCs and verification succeed; an old client has its previous direct-ledger access revoked by recovery and should be updated promptly.

7. Authenticated multi-account/device QA still required

Use real test accounts A/B, an owner/member pair, two browser tabs, a second device, Android Chrome installed PWA, and iPhone Safari/Home Screen PWA. On A's first eligible opening expect one announcement only after bootstrap/read completes. Dismiss/Explore/View Leaderboards, then test refresh, actual browser process termination/reopen, PWA termination/reopen, route changes, token refresh and a service-worker update. Clear only browser cache/storage, sign in again and confirm the server dismissal survives. Repeat on another device. Switch to unseen B, then back to A, confirming independent results. Sign out while a read/save is pending and ensure no stale dialog/navigation leaks into B.

With two A tabs open, dismiss one and require both to close. Throttle reads to check for zero flash; fail a read and save separately, check modern Retry states, and confirm a failed save leaves no acknowledgement before retry. Check DB self-scope/anon denial without sharing account records. Confirm existing 008 acknowledgements remain dismissed. Future release IDs should remain independent; Settings > What's New is intentional reopening.

For groups, verify exactly eight characters, visibility only in Manage Group, Copy/Share, explicit Replace invalidating only the prior code, Join, group-name typing focus, and cross-account membership isolation. Toggle progress sharing and verify the server excludes that member's leaderboard aggregates while preserving membership and private workouts. Verify iPhone/Android layouts/progress widths, startup recovery, password recovery and worker update/offline behavior. Compare private before/after records for Strength, Cardio, Flexibility, Bodyweight, memberships and preferences.

8. Remaining deployment blockers

Live diagnostic results, PostgreSQL execution/partial-prefix/rerun validation, verified ownership/privileges and preserved baselines, physical-device/authenticated QA, and coordinated migration-before-client deployment remain outstanding. No deployment is authorized or performed by this work. There are no outstanding local test, build, lint or dependency-audit failures.

READY FOR MIGRATION 010 RECOVERY REVIEW
