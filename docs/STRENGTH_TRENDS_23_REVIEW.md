# Strength trends 2.3 review — 2026-10-08

The requested chart revision is complete locally. Overall status remains BLOCKED by the unresolved production authentication origin and missing live failure diagnosis documented in AUTH_STRENGTH_REVIEW.md. No SQL, live data changes, accounts, commit, push, or deployment were performed.

## Confirmed causes and behavior

The previous graph deliberately omitted empty calendar periods and represented absent groups as null. Its Monthly/Weekly selector and global date boundaries could not express the newly requested rolling calendar views. The replacement builds consecutive local-calendar periods, fills every group with numerical zero, and renders straight connected lines with dots, including zero dots. Set IDs are deduplicated; completed sets count once toward their primary group; zero-rep attempts and dates beyond local today are excluded. Existing completed distance-set rules remain intact. Stored records are unchanged.

For example, January Chest=2 and March Chest=1 previously produced sparse January/March points. A three-month view ending in March now produces January=2, February=0, March=1, with all other groups present as zero. The long graph explanation is removed. Location filtering remains shared; this graph's selected timeframe determines its date boundaries independently of the other Progress date filter.

Ordered options: All Time, Past Year, Past 6 Months (default), Past 3 Months, Past 6 Weeks. Month views include the current month plus 11, 5, or 2 preceding months. Week views include the current Monday-based week plus five preceding weeks. All Time starts at the earliest qualifying month for the selected location and ends in the current month. No qualifying All Time data shows the empty state; fixed ranges still show calendar zeros. Calendar increments use local dates across DST. With fixture today October 8, 2026, the year starts November 2025; six months starts May 2026; three months starts August 2026; six week starts are August 31, September 7/14/21/28, October 5. Current periods remain partial. Monthly labels include year; weekly labels use short month/day; tooltips show complete periods.

The legend keeps original colors, fills visible markers and hollows hidden markers, exposes aria-pressed and a live notice, supports keyboard controls, and prevents hiding the last visible group. Hidden groups leave the tooltip and axis calculation. Whole-number nice-axis ticks use visible values, padding, a nonnegative minimum and no fixed ceiling. Browser evidence verifies actual rendered ticks change from a 0–60 domain to 38–46 with ticks 38/40/42/44/46 when zero groups are hidden. Visible zeros restore a zero minimum. Removing overflow clipping preserves zero dots. Existing compact green Weight PR and blue Rep PR summaries, icons and independent wheel timeframe behavior are preserved.

## Announcement persistence

The new ID is progressive-overload-2.3-strength-trends. Old release IDs and acknowledgement data are untouched. Existing arbitrary-ID get_release_acknowledgement and acknowledge_release RPCs already support it; no new migration is needed for this revision. The previously prepared, unapplied migration 014 remains unchanged and requires separate review.

Dismissal synchronously writes a per-account pending local acknowledgement before attempting the server save. It remains dismissed through reload, failed saves, token refresh and account switching. Pending saves reconcile on subsequent mounting, online and visibility recovery without reopening the modal. Requests are deduplicated for Strict Mode, scoped to the captured account token, bounded by 15-second request deadlines, and retry transient failures at most three times with 250/500ms delays. Genuine RPC errors are not repeatedly retried. Server acknowledgements reconcile local state. The modal waits for account readiness and excludes authentication callback/recovery routes; stale effects cannot publish another account's result. Explicit existing What's New action permits intentional replay; automatic display remains once per acknowledged account.

The white/red/black announcement has one continue action, keyboard focus containment, Escape dismissal, scrollable small-screen content and no horizontal overflow. At 320×568 its dialog is 288×536 and scrolls; initial focus brings the continue button into view. At 390×844 the entire dialog fits. If browser storage is unavailable and the server save also fails, only the in-memory dismissal can be retained; cross-device suppression likewise depends on eventual server acknowledgement.

## Files changed for this revision

- src/features/strength/setTrend.ts
- src/features/strength/SetsByMuscleGroup.tsx
- src/features/progress/ProgressFeature.tsx
- src/index.css
- src/App.tsx
- src/components/ConfirmDialog.tsx
- src/components/StrengthTrendsAnnouncement.tsx (new)
- src/lib/strengthTrendsRelease.ts (new)
- src/features/strength/setTrend.test.ts
- src/features/strength/setTrendHotfix.test.ts
- src/features/strength/setTrendRegression.test.tsx
- src/features/strength/attempts22.test.ts
- src/lib/strengthTrendsRelease.test.ts (new)
- tests/browser/muscleTrend.jsx
- tests/browser/runMuscleTrend.mjs
- docs/STRENGTH_TRENDS_23_REVIEW.md
- docs/strength23-dependency-audit.json
- docs/strength23-rendered-results.json
- docs/strength23-announcement-320-results.json
- docs/strength23-screenshots/{screen-320,screen-375,screen-390,screen-430,screen-768,screen-1280,announcement-320,announcement-390}.png

Earlier authentication, wheel, candidate migration and user scratch-file changes remain preserved; their separate manifest is in AUTH_STRENGTH_REVIEW.md. No historical review artifacts or applied migrations were changed.

## Validation and remaining QA

Full suite: 600 tests across 98 files pass, including authentication callback and startup race suites. Focused graph/release suites: 39 pass in America/New_York; 23 graph tests also pass in UTC. Lint with --deny-warnings: zero warnings. TypeScript checks, production build and git diff --check pass. Dependency audit: zero vulnerabilities, saved in strength23-dependency-audit.json.

Actual Chromium browser checks pass at 320, 375, 390, 430, 768 and 1280 pixels: ranges/boundaries, 42 default dots including 36 zero dots, connected paths, visible-zero and hidden-group tooltips, rendered axis zoom, original-color hollow legend, last-visible prevention, native Enter keyboard toggling, compact PR layout and no horizontal overflow. Announcement checks include failed-save immediate dismissal, real page reload, later reconciliation, separate accounts, Escape, focus containment and confirmation/recovery exclusions. The smallest announcement also passes independently after the fixture's lint correction. Results and screenshots are saved beside this report.

Local browser checks use isolated mock accounts and RPCs, not live Supabase. Physical mobile/PWA and real authenticated cross-device persistence remain manual QA. For the earlier auth work, the exact production hostname and actual failing bootstrap response are still unavailable; neither a production root cause nor a need to apply migration 014 can be confirmed. Exact local/preview URL settings and all requested authenticated manual testing steps remain in AUTH_STRENGTH_REVIEW.md; no production hostname has been invented.

Manual chart QA: create January and March successful sets with February empty; verify February zeros and continuous paths in each range. Add a zero-rep attempt and a future-day entry; neither changes this chart. Toggle zero groups to check axis zoom, keyboard behavior and tooltips; try hiding the last group. Compare wheel PR totals and colors while changing its own timeframe. Dismiss the 2.3 announcement offline, reload, reconnect, switch accounts, then reopen the PWA; it should stay dismissed for the acknowledged account and appear once for a new eligible account. Verify callback/recovery screens never show it. Review the screenshots before any commit or deployment.
