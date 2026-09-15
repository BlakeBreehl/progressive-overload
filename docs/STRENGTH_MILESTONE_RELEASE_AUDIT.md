# Final predeployment repair and Group Code release report

Updated September 15, 2026. This report supersedes the interrupted report's validation counts and claims. Local implementation and automated validation are complete. Authenticated release QA is a separate gate; no local test proves live RLS or email delivery.

## 1. Recovered working tree

The starting tree already contained partial edits to ConfirmDialog, TimeXAxis, GroupsFeature/repository, ProgressFeature, Strength calculations and tests, numeric-integrity tests, weight-unit tests and CSS. Untracked work included this report, StrengthPointMarker, exerciseSort, marker/rendering/sorting tests, and two browser fixture files. These changes were inspected and retained.

Already implemented: the three Strength modes, increasing one-rep milestones, four-rep Rep Weight milestones, removal of obsolete PR graph code, custom set markers, categorical set-ID axes, Straight/Smooth controls, table sorting/pagination, and a shared dialog focus-effect repair. The initial full suite passed 314 tests, but TypeScript failed on an optional achievement field in the new sorting test. The old report's 305-test and mobile/readiness claims were stale and were not accepted as evidence.

Incomplete or incorrect: invitation links remained the main Groups workflow; Settings remained in More, the desktop sidebar and mobile header; dark navigation backgrounds had dark labels; active navigation relied on color; chronology used calendar dates without performance times; distance/laps sets were missing from table counts; mixed-history reps-only tooltips could inherit a weight unit; the browser fixture had not been completed or validated. All are addressed in the current changes.

## 2. Missing markers: confirmed cause and representation

The original Strength Line used `connectNulls dot={false}`. All Logged Sets already emitted lower values, but the renderer suppressed its ordinary point markers. An active Recharts marker could appear under interaction, which was not an always-visible marker for each record. This was a rendering defect, not a reason to discard valley data. Separately, the old Rep Weight algorithm admitted lower 3+ rep sets and the obsolete PR mode mixed secondary values; those calculation defects were removed.

The current single series uses a custom marker for each valid filtered set, animation disabled, and actual set IDs for categorical X values. Repeated dates have independent, equally spaced set positions with their real date labels; neither stored dates nor results are changed. This is a categorical sequence, not an elapsed-time-proportional axis. Every point retains its ID, date, exercise, actual displayed value/unit, reps and location. Focus, Enter/Space, hover and click activate that exact record in the tooltip and persistent accessible details. Reps-only points say reps, including within exercises with older weighted history. Distance/laps/time-only distance records use their recorded metric.

Exercise, location and date filtering precede series construction. Performance timestamps determine order, followed by creation timestamp, set order and ID. Display-unit conversions affect copies only. The required `225, 185, 235, 175, 240` fixture has five markers and five matching detail records under both Straight and Smooth, including both valleys. Repeated values, duplicate dates, independent sets, backdating, unsorted input, mixed units, invalid numerics and filtering are covered by tests. Invalid dates/numeric records are excluded rather than fabricated.

Only three modes remain. One Rep Max requires exactly one rep and strictly greater weights. Rep Weight requires at least four reps, emits higher weights or improved reps at the current best weight, and never emits a lower weight. Only All Logged Sets intentionally zigzags. Technical graph blurbs and the obsolete graph PR option are absent. Actual achievement badges retain green Weight PR and blue Rep PR styling and exclusive classification.

## 3. Exercise table sorting

Monthly and yearly tables use the shared custom Select labeled Sort exercises. Most Sets is the default; Alphabetical is available. Each table retains its own choice while mounted. The repository fetches the complete account-owned set population in stable 500-row batches. Tables apply date/location filters, period eligibility and normalized-name search before counting, sorting and 20-exercise pagination. Counts represent actual sets, including reps-only and Distance/Laps, not historical summary rows. Duplicate IDs count once. An exercise's period cells and achievement data remain grouped and unchanged.

Most Sets sorts descending by count; ties use trimmed, whitespace-collapsed, case-normalized names, then IDs. Alphabetical uses the same deterministic name/ID ordering. Monthly counts cover represented months; yearly counts cover represented years, with active date/location restrictions applied to both. Zero-count exercises can remain visible with empty period cells. Search covers the complete table population, not its current page.

## 4. Group Name focus: confirmed cause

The original ConfirmDialog effect depended on `[open, busy, onCancel]`, while Groups supplied a newly created inline onCancel callback on every render. Each character changed form state, restarted the effect, restored earlier focus in cleanup, then focused Cancel again in a microtask. The input itself did not need to remount to lose focus.

The retained repair runs focus setup only when open changes and uses useEffectEvent for current busy/cancel behavior. It also cancels pending initial focus on cleanup. There is no per-keystroke refocusing timer. Group name, display name, Group Code and rename fields share this stable dialog; no editable role/member-ID fields exist. Browser regressions type a full multiword name character by character, assert DOM identity/focus/caret, replace selections and delete text, paste a code, trigger validation and complete a join. Native iOS/Android software-keyboard behavior remains part of device QA.

## 5. Final Group Code workflow and database decision

**Migration 009 is reused unchanged. No migration 010 exists or is required.**

- Create Group creates the group through create_private_group, then requests its first code through manage_private_group with action invite. If code generation fails after creation, the group remains created and the UI directs the owner to generate a code; it does not recreate the group.
- The owner receives a readable, selectable Group Code card with Copy Code and Share Code. Web Share sends only the group name and code as text. Unsupported/failed sharing falls back to copy; cancellation is respected. Clipboard failure leaves manual selection/copy available.
- Generate / Rotate Code explicitly warns that every previous code is invalidated. Disable joining revokes codes. Neither operation removes existing members.
- Join a Group accepts the code without opening a link. The existing display-name and sharing-consent fields remain because the RPC requires a public display name and group sharing is explicit. Input state is not reformatted while typing. Submission removes whitespace/hyphens and lowercases the code before the authenticated join_private_group RPC.
- A successful join selects the returned group, clears the prior summary/code/activity/member-visibility state and reloads membership. Existing membership is an idempotent server success, not a second membership or an owner promotion.
- Invalid, expired, exhausted, revoked and rotated codes share one generic error with no private group details. Network and expired-session failures retain their appropriate recovery messages.
- Old fragment links are only a compatibility input; no normal link-sharing controls remain.

### Exact encoding and security

009 generates a 64-character hexadecimal token by concatenating two server-generated random UUIDs without hyphens. The UI uppercases the *complete* token and inserts a hyphen after each four characters (16 groups). Removing separators and lowercasing reproduces the exact original token. It does not display a group/member database UUID or read a stored hash, shorten the secret, use Math.random, or change entropy. Two random version-4 UUIDs provide 244 random bits; the format intentionally retains the existing hex alphabet rather than pretending it is an eight-character code.

Only the SHA-256 digest is stored in group_invites. The raw code lives in component memory after generation and is not persisted in browser storage or fetched from an invitation table. Leaving/reloading the screen loses that copy; the card advises copying it first. An owner can rotate to obtain another code.

The server authenticates the caller, validates format, hashes and checks the token, enforces seven-day expiration, revocation and 100-new-member capacity, and locks the group/invitation against concurrent rotation/removal/joining. Membership has a `(group_id,user_id)` primary key. Existing members do not consume another use; new members always receive role member. Ownership and totals are never supplied by the client. There is no direct private group lookup by code and no invitation enumeration grant. 009 has no dedicated per-user failed-code rate limiter: this report does not claim one. Authenticated access plus the retained 244-bit secret provides strong resistance to code guessing; shortening it would require a separate security design.

## 6. Groups and Leaderboards audit

Read-only inspection and static contract tests verify the existing owner-only rename/delete/code generation/revocation/member-removal checks, owner removal/leave prevention, membership-gated summaries, grants/RLS declarations and lock order. Delete cascades only group membership/invitations, not personal activity. Frontend mutations reload groups and invalidate summaries. Group/period/activity/revision/account keys prevent mismatched summaries from displaying; the Groups component itself now keys its inner state by account, even when used outside App's existing account key.

Summary RPCs return aggregate totals and membership handles/display names, not emails, Bodyweight, notes, locations or raw workout rows. There is one summary RPC per selection, not one raw-data request per member. Calendar week/month boundaries and current-month PR totals use server calculations and timezone; First Entry is excluded and Weight PR precedes Rep PR. Muscle breakdowns expose accessible counts; member colors now include contrasting red, green, blue, black, orange, purple and teal. Cardio ranks durations and compatible converted length totals, leaving missing distance unranked. Loading, empty, failure/retry, permission and expired-session messages remain available.

These are frontend/static findings. RLS execution, concurrency and real account isolation have NOT been exercised against live Supabase.

## 7. Navigation, Settings and visual review

Mobile primary destinations are Home, enabled Strength, Progress, Leaderboards and More when secondary modules exist. More contains only enabled Cardio, Flexibility and Bodyweight. Settings is absent from the bottom bar, More, desktop primary sidebar and mobile header. The Home gear is the canonical Settings action and opens the existing Settings route. Direct Settings route parsing, browser-history paths and deployment SPA fallback remain covered; actual hosted refresh/Back behavior still needs QA.

Navigation uses a white background, readable dark labels, red active text plus a visible underline/background and aria-current. Touch targets are at least 44 CSS pixels in the tested matrix; the Home gear is also at least 44 pixels. Safe-area padding and content clearance are retained. Module visibility only changes navigation and does not delete data.

The local Chromium matrix uses the real Groups, Progress, custom Select, dialog and MobileNavigation components, mocked RPCs, an isolated profile and CSP blocking nonlocal connections. Sizes: 320x568, 360x640, 375x667, 375x812, 390x844, 393x852, 412x915, 430x932, plus 667x375 landscape. Each size tests all 16 visibility masks with 0/20/34/48px simulated bottom insets and normal/125% root text sizing (1,152 navigation layouts). Checks include overflow, bounds, touch targets, persistent primary destinations, More contents, code-card fit, dropdown viewport bounds and exact marker interactions. A Group Code screenshot and navigation screenshot were inspected. Device toolbar dynamics, installed-PWA display mode and real software keyboards are not reproduced by inset simulation; verify them on devices.

## 8. Full release validation

- Full Vitest suite: **331 tests passed in 66 files** (initial tree: 314).
- `npm run lint -- --deny-warnings`: passed, zero warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed; ignored dist output was generated by the build only, not manually edited or tracked.
- `git diff --check`: passed.
- `npm audit --json`: zero vulnerabilities. The sandboxed endpoint request failed; the authorized read-only network retry passed.
- Browser results: **1,388 checks passed at each of nine viewports (12,492 checks), zero failures**, including all 1,152 navigation layouts. Final run artifact: `C:/Users/blake/AppData/Local/Temp/po-release-hmq7W6/results.json`.
- Production scans: no native select/popup calls, obsolete graph PR option, removed Strength blurbs or stale user-facing Mobility/module-Weight labels. Remaining session references concern authentication/internal schema. undefined occurrences are guarded optional values/types/default locale parameters; reps-only tooltip regressions reject undefined/NaN/Infinity/fake-weight output. The sole service-role wording is an existing warning in the configuration screen, not a key. No privileged key was added. Only .env.example is tracked; .env and .env.local remain ignored.

The existing suite also covers startup authentication/account restoration and switching, generic reset responses/recovery/password forms, Strength numeric integrity and PR chronology, ordered independent sets, history ownership/search/pagination/edit/delete contracts, Cardio/Flexibility wheels and starter libraries, Bodyweight unit conversions/continuous lines/weekly comparisons, PWA API-cache exclusions/icons/routes and per-account release acknowledgement. It does not substitute for authenticated end-to-end testing of those features.

Reproduce browser checks with `node tests/browser/serveFocusedRelease.mjs`, then `node tests/browser/runFocusedRelease.mjs` in another terminal. CHROME_PATH can override the Windows Chrome binary. Reports/screenshots use an isolated OS temporary directory. Input events and inset emulation are synthetic; no real accounts or workout records are used.

## 9. Every changed/new file

Paths are relative to the repository; this list includes retained interrupted work.

| File | Change |
| --- | --- |
| src/App.tsx | Remove duplicate Settings navigation/header controls; preserve Home entry |
| src/components/ConfirmDialog.tsx | Stable focus lifecycle, fresh keyboard callbacks, working label |
| src/components/MobileNavigation.tsx | More icon/copy; enabled secondary modules only |
| src/components/TimeXAxis.tsx | Map stable categorical set IDs to real date ticks |
| src/domain/groupNavigation.ts | No Settings destination; omit empty More |
| src/domain/groupNavigation.test.ts | Visibility matrix and canonical Settings-entry contracts |
| src/features/groups/GroupsFeature.tsx | Group Code owner/join workflow, creation recovery, account isolation, colors |
| src/features/groups/logic.ts | Normalize compatibility fragment/code input |
| src/features/groups/repository.ts | Normalize secure join RPC input; private errors and session recovery |
| src/features/groups/groupCode.ts | Reversible code presentation and copy/share helpers (new) |
| src/features/groups/groupCode.test.ts | Code/RPC/sharing/error/security contracts (new) |
| src/features/progress/ProgressFeature.tsx | Marked graphs/details/styles, sorting controls, valid Distance/Laps table counts |
| src/features/progress/StrengthPointMarker.tsx | Exact-set accessible interactions and metric labels (new) |
| src/features/progress/strengthModes.ts | Three filtered chronological modes, monotonic milestones, per-point metrics |
| src/features/progress/strengthModes.test.ts | Milestone, filtering, chronology and immutability regressions |
| src/features/progress/allSetsMarkers.test.tsx | Valleys, identity, interactions, units, laps and table rendering (new) |
| src/features/progress/strengthRendering.test.tsx | Single marked-series and detailed tooltip contracts (new) |
| src/features/progress/exerciseSort.ts | Full-population counting, normalized sorting and pagination (new) |
| src/features/progress/exerciseSort.test.ts | Sorting, grouping, filtering, search, paging and immutability (new) |
| src/features/progress/logic.ts | Remove unused obsolete Strength graph helpers |
| src/features/progress/logic.test.ts | Retain current table logic tests; remove obsolete helper tests |
| src/features/strength/numericIntegrity.test.ts | Assert exact numeric values through active graph pipeline |
| src/lib/weightUnits.test.ts | Use retained All Logged Sets mode for unit invariance |
| src/index.css | Marker focus, code card, navigation contrast/active state/safe areas/touch sizing |
| tests/browser/focusedRelease.jsx | Mocked real-component browser regression fixture (new) |
| tests/browser/serveFocusedRelease.mjs | Local fixture server and nonlocal connection restriction (new) |
| tests/browser/runFocusedRelease.mjs | Isolated Chrome/CDP viewport runner and optional screenshot capture (new) |
| docs/STRENGTH_MILESTONE_RELEASE_AUDIT.md | This corrected release report (new) |

## 10. Exact authenticated release QA still required

Use authorized disposable QA accounts A (owner), B (joining member), C (unrelated account). Do not rewrite historical production records. Migration 009 is already applied and MUST NOT be rerun.

1. **Create and join:** A creates G and copies its code. B types/pastes it in lower/uppercase, spaced and hyphenated forms, consents and joins. G must open with role Member. Repeat acceptance with B: one membership and no extra use. Confirm existing groups/members/activity are unchanged. Refresh/sign out/back in; membership persists and raw code is not recovered from storage.
2. **Rotation/revocation/expiry/capacity:** Rotate as A before C joins; C's old code must fail generically, new code succeeds only on an explicit valid join. Disable joining; every unused code must fail. Use reviewed disposable expired/exhausted fixtures or natural expiry to verify those paths, including existing-member acceptance after expiry. Compare all invalid error wording for no group-name/member leakage. Test concurrent joins and rotation/removal with two browser sessions; unique membership and capacity must hold.
3. **Role enforcement/isolation:** Before joining, C cannot read G or its summary by a known ID. B must be denied direct table mutations, self-promotion, rename/delete/code rotation/revocation and removing A. Test using B's authenticated client, not just hidden buttons. Invitation hashes must remain unreadable. A may rename/remove B; B's next summary/mutation must be denied and its UI cleared. B can leave; A cannot leave/remove itself; A may delete G without losing personal activities. C's unrelated groups remain inaccessible to A/B unless explicitly joined.
4. **Refresh/races/states:** Switch groups and accounts during delayed list/summary/join requests. No earlier account's names, code, form values or totals may appear. Exercise offline, revoked/expired auth, permission errors and Retry. Verify mutations refresh group names/members/leaderboard totals. Test successful group creation followed by a failed code-generation request; retry code generation without creating another group.
5. **Leaderboards:** Add disposable Strength sets across calendar week/month boundaries, muscle groups, mixed units, first entries, exact-weight Rep PRs and Weight PRs. Compare sums/PR exclusivity with expected fixtures in the selected timezone. Test Cardio durations and compatible distances by activity/person, missing distances and ties. Inspect RPC responses for no Bodyweight, notes, locations, raw workouts or emails.
6. **Authentication/email:** Verify actual Supabase Site URL and exact production /auth/reset-password allowlist. Test signup, signin/out, cold restoration without refresh, account switching, generic Forgot Password responses for existing/nonexistent emails, real delivery, valid/expired/reused/invalid recovery links, Set New Password, Settings Change Password and any email reauthentication. Repeat browser and installed PWA. No local test proves email delivery or dashboard configuration.
7. **Personal modules:** Add/edit/delete disposable Strength Weight+Reps, Reps Only and Distance/Laps entries with multiple ordered sets and independent same-day/backdated entries. Verify history newest-first, All Time, global search/server pagination and recalculated exclusive PRs. Recheck five graph points, same-day details, both line styles, location/date/unit filters and exercise sorting across page boundaries. Exercise Cardio duration extremes 00:00:01 and 99:59:59, optional metrics and permanent locations; Flexibility two-column MM:SS, reps/multiple sets/starters; Bodyweight Morning/Evening, mixed units, notes search, both lines/styles and adjacent-week summaries.
8. **Devices/PWA/navigation:** On an iPhone and Android, test browser dynamic toolbars, installed standalone PWA, home/gesture and three-button navigation, portrait/landscape, larger text and software keyboard paste/cursor editing. Check dialogs/dropdowns/code card/graph interactions above the keyboard and bottom bar. Verify every enabled module, Home Settings, direct /settings refresh, Back, offline shell, icons, uncached Supabase/API responses, Your Sets month count and announcement once per account/release.

## 11. Safety and deployment gate

Migrations 001-009 have no working-tree diff; the directory still contains exactly those nine migrations. No migration 010, SQL execution, live Supabase mutation, commit, push or deployment occurred. .env/.env.local ignore rules and all pre-existing workout/account/group records were preserved.

No known implementation blocker remains after local validation. Deployment still requires the authenticated/device QA above and verification of the actual production recovery URL settings. This is readiness for that QA, not authorization to deploy.


READY FOR AUTHENTICATED RELEASE QA
