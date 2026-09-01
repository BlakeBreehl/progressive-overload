# Progressive Overload Supabase setup

These steps are intentionally manual. The project does not contain a service-role key. Migrations `001` through `005` are already applied remotely; do not rerun them.

1. Create or select a Supabase project.
2. Open the Supabase SQL Editor and paste the complete contents of `supabase/migrations/202608300001_progressive_overload_foundation.sql` into a new query. Review it, then run it once.
3. In Authentication > Providers, leave Email enabled. Choose whether email confirmation is required for your environment.
4. Copy `.env.example` to `.env.local`.
5. Add the project URL and browser-safe publishable/anon key to `.env.local`. Do not use a service-role key in this frontend.
6. Restart the Vite development server after changing environment variables.

The migration creates profile and settings companion rows for new auth users and safely backfills those two rows for auth users that already exist. It does not seed exercises or import workout data.

## Strength phase migration

Migration `supabase/migrations/202608300002_strength_whole_reps.sql` has already been applied. Do not run it again.

After migration `002` has been applied, review and manually apply `supabase/migrations/202608300003_private_starter_exercises.sql` once. It adds private starter libraries and many-to-many exercise groups, backfills existing accounts, and installs future accounts automatically. Do not reapply migrations `001` or `002`.

## Activity modules migration

Migrations `001`, `002`, `003`, and `004` have been applied and remotely verified. Do not rerun them. Migration `004` installs each account's private Cardio starter activities and adds Flexibility body-area assignments and set counts while retaining the applied `mobility_*` database identifiers.

Do not run this migration from the app or expose a service-role key. Disabling any module only changes `user_settings`; it never deletes module records.

## Disabled workbook-import schema and production auth

Migrations `001` through `006` have already been applied remotely. Do not rerun them. Migration `006` belongs to a removed workbook-import experiment. Its unused tables and nullable provenance columns are harmless, but the shipped application does not query them and normal workout tracking does not depend on them. Do not create a rollback migration merely to remove this dormant schema.

For production:

1. Set Supabase Authentication > URL Configuration > Site URL to the deployed HTTPS origin.
2. Add the deployed origin and any approved auth callback paths to Redirect URLs. Do not use wildcard production origins unnecessarily.
3. In Netlify, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the browser-safe project values. Never add a service-role key.
4. Trigger a fresh build after changing environment variables.
5. Verify sign-in, email confirmation, sign-out, and a direct navigation refresh before launch.
