import { describe, expect, it } from "vitest";
import foundation from "../../../supabase/migrations/202608300003_private_starter_exercises.sql?raw";
import catalog from "../../../supabase/migrations/202609010007_strength_load_modes_and_catalog.sql?raw";

describe("starter migration contracts", () => {
  it("preserves the original ownership and RLS foundation", () => {
    expect(foundation).toContain("foreign key(exercise_id,user_id) references public.exercises(id,user_id)");
    expect(foundation).toContain("alter table public.exercise_group_assignments enable row level security");
  });
  it("adds forward-only load modes, normalized deduplication, and future-user installation", () => {
    expect(catalog).toContain("add column if not exists load_mode");
    expect(catalog).toContain("regexp_replace(trim");
    expect(catalog).toContain("on_auth_user_seed_strength_catalog_v2");
    expect(catalog).toContain("for v_user_id in select id from auth.users");
  });
  it("renames safely and preserves conflicts", () => {
    expect(catalog).toContain("set name = 'Dumbbell Bench Press'");
    expect(catalog).toContain("and not exists");
  });
});
