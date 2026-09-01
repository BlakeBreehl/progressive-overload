import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import editor from "./StrengthFeature.tsx?raw";
import migration from "../../../supabase/migrations/202609010007_strength_load_modes_and_catalog.sql?raw";
import { saveExercise, type ExerciseInput } from "./repository";

const base: ExerciseInput={name:"Custom",trackingType:"repetitions",loadMode:"weight_reps",majorMuscleGroups:["Chest"],muscleTags:["Mid Chest"],isCompound:false};
describe("exercise load-mode management",()=>{
  it("saves all three UI modes through the transactional RPC",async()=>{const rpc=vi.fn().mockResolvedValue({data:"id",error:null}),client={rpc}as unknown as SupabaseClient;await saveExercise(client,"u",base);await saveExercise(client,"u",{...base,loadMode:"reps_only"},"id");await saveExercise(client,"u",{...base,trackingType:"distance"},"id");expect(rpc.mock.calls.map(call=>call[1].p_exercise)).toEqual([expect.objectContaining({tracking_type:"repetitions",load_mode:"weight_reps"}),expect.objectContaining({tracking_type:"repetitions",load_mode:"reps_only"}),expect.objectContaining({tracking_type:"distance",load_mode:"weight_reps"})])});
  it("uses the shared Select and requires confirmation for used exercises",()=>{expect(editor).toContain('label="Logging behavior"');expect(editor).toContain('label: "Weight + Reps"');expect(editor).toContain('label: "Reps Only"');expect(editor).toContain('label: "Distance/Laps"');expect(editor).toContain("exercise.usageCount > 0");expect(editor).toContain("<ConfirmDialog")});
  it("keeps legacy rows and validates future writes in migration 007",()=>{expect(migration).not.toContain("update public.strength_sets set weight");expect(migration).toContain("Reps-only exercises cannot store weight");expect(migration).toContain("Weight + Reps exercises require nonnegative weight");expect(migration).toContain("save_strength_exercise")});
});
