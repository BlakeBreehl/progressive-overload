# Progressive Overload modules

The user-facing training modules are Strength, Cardio, Flexibility, and Weight.

Flexibility records a stretch/activity, duration per set, number of sets, notes, and one or more muscles or body areas. The applied Supabase schema intentionally retains the existing `mobility_enabled`, `mobility_activities`, and `mobility_sessions` identifiers for compatibility.

Creation screens use refresh-safe routes: `/strength/new`, `/cardio/new`, `/flexibility/new`, and `/weight/new`. Normal module navigation continues to use the route without `/new`.
