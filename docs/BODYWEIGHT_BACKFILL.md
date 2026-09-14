# Bodyweight backfill

No frontend rebuild or Netlify deployment is needed. These files are standalone Supabase SQL Editor operations and must never become migrations or unauthenticated frontend features.

The source contains **219 dates** and **438 readings**. The repository did not contain an account UUID; the previous file still had `d8f07d80-c4e8-4afc-b849-76218d0fad58`. Replace that placeholder with the same Authentication User UID in all three files.

1. Run the entire [PREFLIGHT file](./bodyweight-backfill-PREFLIGHT.sql). Require `target_user_exists = true`, `source_dates = 219`, `morning_records = 219`, `evening_records = 219`, `total_records = 438`, `conflicts = 0`, and `conflict_details = []`. Record the exact-match and new-record counts.
2. Run the entire [IMPORT file](./bodyweight-backfill-IMPORT.sql) once. Its notice reports 219 dates, 438 readings, exact rows already present, inserted rows, and 438 final exact readings. Any error rolls back the whole statement.
3. Run the entire [VERIFY file](./bodyweight-backfill-VERIFY.sql). Require `target_user_exists = true`, `exact_source_readings = 438`, `missing_source_readings = 0`, and `conflicts_or_duplicates = 0`. Boundary records must show June 22, 2024 (Morning 183.2 lb at 08:00; Evening 184.4 lb at 20:00) and August 31, 2026 (Morning 190 lb at 08:00; Evening 192 lb at 20:00).
4. Refresh the app. Open Weight, select **All Time** and **Morning & Evening**, then inspect Morning and Evening separately.

All calendar matching uses `America/New_York`. Each file is self-contained and shares no connection state. The import inserts missing rows only; it never updates, deletes, or targets another user.

The supplied “Day 1 = December 3, 2023” statement conflicts with the mutually consistent required mappings Day 173 = June 22, 2024, Day 973 = August 31, 2026, and Day 974 = September 1, 2026. Explicit source dates govern.

