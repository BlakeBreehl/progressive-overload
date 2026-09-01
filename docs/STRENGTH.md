# Strength implementation notes

Strength records only literal performance. It does not calculate or store estimated one-rep maximums, projected strength, or formula-based scores.

## Personal records

- The first valid repetition set for an exercise establishes a restrained **First record** baseline.
- A **Weight PR** requires weight strictly above every earlier dated repetition set for the exercise.
- A **Rep PR** requires reps strictly above every earlier set at the exact same recorded weight.
- Ties are not PRs. Sets are evaluated by workout timestamp and set order. Editing or deleting source data recalculates badges.
- Existing historical monthly/yearly records participate at midnight on their `period_start`; actual sets later on that date are evaluated afterward.
- Distance history is displayed as entered. Distance PR categories are deliberately deferred until comparison rules are defined.

Strength weights and loads display the user's preferred unit label. Historic values are never silently converted.

## Quick logging

`/strength/new` is a single-exercise, single-set flow. Repetition entries ask only for exercise, weight, reps, local date, and optional location. Distance exercises instead ask for load, distance per lap, unit, laps, and optional duration. Saving uses the existing transactional workout RPC, producing one workout and one set with `set_order = 1`.

One-set entries reopen in the quick editor. Existing multi-set or multi-exercise workouts continue to use the advanced editor and are never reshaped. After a save, **Log Another Exercise** keeps the chosen date and location while clearing the exercise and result fields.

## Applied-schema compatibility

Exercise-name normalization is enforced in both the UI and the new transactional save function. No case-insensitive unique index is added because unknown existing duplicates should be reviewed before introducing such an index.

The applied migration `202608300002_strength_whole_reps.sql` adds whole-repetition constraints plus authenticated transaction functions for workout saves, exercise/tag saves, and default-location changes. It must not be rerun.

## Private starter library and categorization

Migration `202608300003_private_starter_exercises.sql` gives each account private, user-owned copies of 116 starter exercises. Existing users are installed once during the migration; future users are installed by an auth trigger. A `starter_library_installations` marker is written only after the atomic installation succeeds. Refreshing or signing in does not run a count-based seed, so permanently deleted unused starters stay deleted.

Normalized names are compared before installation. An existing user-created match is preserved exactly and its groups, tags, tracking type, and Compound value are never overwritten.

Major groups are many-to-many through the user-owned `exercise_group_assignments` table. The legacy `major_muscle_group` column remains populated with the first selected group for compatibility. Compound remains an independent boolean, never a muscle tag.

Exercises with no dependent history can be permanently deleted after confirmation. Exercises referenced by workouts or historical records remain protected by foreign keys until those entries are deleted.

Workout location remains optional: a default can autofill, but it may be cleared or replaced per workout. Existing locations remain attached to history for future gym-specific statistics. Weight and Rep PRs remain all-location records. Sled Push and Yoke Carry use distance/lap tracking. No estimated-strength metric exists.
