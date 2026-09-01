-- READ ONLY. Run as the affected authenticated user. Low values are review
-- candidates only; this query does not assert that any saved set is corrupt.
select
  ss.id as set_id,
  ss.workout_id,
  sw.performed_at,
  ss.set_order,
  e.name as exercise_name,
  ss.weight,
  ss.reps,
  ss.created_at
from public.strength_sets ss
join public.strength_workouts sw
  on sw.id = ss.workout_id and sw.user_id = ss.user_id
join public.exercises e
  on e.id = ss.exercise_id and e.user_id = ss.user_id
where ss.user_id = auth.uid()
  and ss.tracking_type = 'repetitions'
  and ss.reps between 1 and 3
order by sw.performed_at desc, ss.set_order;
