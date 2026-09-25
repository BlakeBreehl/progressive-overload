# Progressive Overload 2.1 automated results

Local verification on 2026-09-23. No database execution or authenticated manual testing occurred.

| Check | Final result |
|---|---|
| `npm test -- --reporter=dot --silent` | PASS: 82 files, 483 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS: TypeScript and production Vite build |
| `git diff --check` | PASS |
| `npm audit --json` | PASS: 0 vulnerabilities across 188 dependencies; public npm registry request required sandbox escalation, which was approved |
| 2.1 browser features | PASS: 16 configurations × 40 assertions = 640; 320/375/390/430 px in Android browser/standalone and iPhone browser/standalone emulation |
| 2.1 desktop features | PASS: 768/1280 px × 40 assertions = 80 |
| Navigation / existing release regression | PASS: four required phone widths × 1,381 assertions = 5,524; all 16 module combinations, 4 safe-area sizes, 2 font scales |
| Progress/mobile regression | PASS: four required phone widths × 177 assertions = 708; no overflow offenders |
| Every leaderboard, tied scores / missing distance | PASS: 4 phone and 2 desktop widths × 16 assertions = 96, using a fresh isolated browser per viewport after a browser-driver reuse timeout |
| Environment protection | `.env` and `.env.local` ignored and untracked |
| Secret pattern scan | No service-role JWT, private-key block, or populated secret-key patterns found in 233 versioned/unignored text files; environment contents were not inspected |
| Native controls and relationships | No active native alert/confirm/prompt/select in application source; modified embedded queries use ownership FK hints, including the new paged Cardio Progress loader |
| SQL runtime, authenticated two-account QA, physical iPhone | NOT RUN / release gates remain blocked under the no-Supabase/no-SQL instruction |

Evidence files are local root artifacts: `.test-results.txt`, `.lint-results.txt`, `.typecheck-results.txt`, `.build-results.txt`, `.audit-results.json`, `.security21-results.json`, and the browser result files above. Older incoming `.announcement21-results.txt` was retained; it is not evidence of a fresh authenticated test. Early browser runs were interrupted after stalling; the final runs above completed after adding bounded CDP command waits and disabling background throttling in the isolated headless runner.

Browser tests serve only local mock fixtures with a CSP restricting connections to the local server. Android/iPhone/PWA labels describe Chromium emulation, **not native Safari or real installed PWA authentication**. Expected simulated lazy-module failures in the mobile fixture verify the Retry path.

To reproduce browser checks, start `node tests/browser/serveFocusedRelease.mjs`, then run `node tests/browser/runFocusedRelease.mjs` with these environment variables in a separate PowerShell process:

| Fixture | Environment variables |
|---|---|
| 2.1 mobile | `RELEASE21=1`, `REQUIRED_WIDTHS=1`, `MOBILE_MATRIX=1` |
| 2.1 desktop | `RELEASE21=1`, `DESKTOP_ONLY=1` |
| Navigation | `REQUIRED_WIDTHS=1` |
| Progress/mobile | `MOBILE_REPAIR=1`, `REQUIRED_WIDTHS=1` |
| All leaderboard types, phones | `RELEASE21=boards`, `REQUIRED_WIDTHS=1` |
| All leaderboard types, desktop | `RELEASE21=boards`, `DESKTOP_ONLY=1` |

Do not carry unrelated fixture flags into another run. Use a fresh shell or clear them. The runner uses a new isolated browser profile each time, bounded commands, and cleans up its browser process on normal completion/failure.

Final browser total: **32 configurations, 7,048 passing assertions**. For the targeted leaderboard fixture, run each size separately using `RELEASE21=boards`, `FOCUSED_WIDTH` and `FOCUSED_HEIGHT`: 320×568, 375×812, 390×844, 430×932, 768×1024, 1280×900.

Focused additions cover invalid and missing steps, deterministic measured-only totals, >1,000-row pagination and later-page failures, weighted/assisted PR eligibility and timestamp offsets, decimal/mixed-unit milestones, startup deadlines and backoff, offline restoration, real token-refresh event handling, sign-out/sign-in, Strict Mode subscriber cleanup, normalized assisted starter aliases, migration safety contracts, step create/edit/clear/delete, Y-axis controls, server acknowledgement failure/retry/deduplication, and all leaderboard rank renderers. Existing tests cover the requested calendar/DST boundaries, recovery sessions, RLS/schema classification, phone tick density and service-worker exclusions.

Release blockers and the exact manual migration/QA sequence are in `RELEASE_21_REVIEW.md`. Passing these automated checks does not prove the reported production startup cause or authorize deployment.
