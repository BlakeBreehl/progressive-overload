# Date ordering and index review

Charts sort ascending by numeric `YYYY-MM-DD` calendar keys. Histories sort descending and paginate after active filters. Date-only labels are constructed at local noon so January 1 cannot render as December 31 in US time zones.

The history page size is 20. Strength, Cardio, Flexibility, and Bodyweight apply filters in Supabase, request an exact count, use performance date plus `created_at` and `id` ordering, and request only the current range. Strength uses a paged workout-ID query followed by one set-based child fetch, avoiding N+1 requests.

Migration 007 contains the aligned user-scoped indexes; they have not been applied.

```sql
create index concurrently if not exists strength_workouts_user_performed_id_idx on public.strength_workouts (user_id, performed_at desc, id desc);
create index concurrently if not exists strength_sets_user_exercise_workout_idx on public.strength_sets (user_id, exercise_id, workout_id);
create index concurrently if not exists cardio_sessions_user_activity_location_performed_idx on public.cardio_sessions (user_id, activity_id, location_id, performed_at desc, id desc);
create index concurrently if not exists mobility_sessions_user_activity_performed_idx on public.mobility_sessions (user_id, activity_id, performed_at desc, id desc);
create index concurrently if not exists weigh_ins_user_measured_id_idx on public.weigh_ins (user_id, measured_at desc, id desc);
```

Measure these with production-like `EXPLAIN (ANALYZE, BUFFERS)` before creating a migration.
