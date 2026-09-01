import { describe, expect, it } from "vitest";
import { detectRepetitionPrs, isRepsOnlyExercise } from "./logic";
import { quickLiftToWorkout, validateQuickLift, newQuickLift } from "./quickLog";
import type { Exercise } from "./types";

const pullUp: Exercise = { id:"pull",userId:"u",name:"Pull Up",trackingType:"repetitions",loadMode:"reps_only",majorMuscleGroups:["Back"],muscleTags:["Lats"],isCompound:true,archived:false,createdAt:"",updatedAt:"",usageCount:0,lastUsedAt:null };
describe("reps-only Strength exercises", () => {
  it("classifies canonical unweighted names separately from weighted variants", () => {
    expect(isRepsOnlyExercise(pullUp)).toBe(true);
    expect(isRepsOnlyExercise({ ...pullUp, name: "Weighted Pull Up", loadMode:"weight_reps" })).toBe(false);
  });
  it("validates and submits ordered sets without weight", () => {
    const draft = { ...newQuickLift([], "2024-01-01"), exercise: pullUp, sets:[{weight:"99",reps:"8"},{weight:"80",reps:"10"}] };
    expect(validateQuickLift(draft)).toEqual({});
    expect(quickLiftToWorkout(draft).exercises[0].sets).toEqual([
      expect.objectContaining({setOrder:1,reps:8,weight:undefined}),
      expect.objectContaining({setOrder:2,reps:10,weight:undefined}),
    ]);
  });
  it("awards reps but never weight PRs by performance chronology", () => {
    const result=detectRepetitionPrs([
      {id:"later",exerciseId:"pull",setOrder:1,trackingType:"repetitions",reps:12,performedAt:"2025-01-01"},
      {id:"first",exerciseId:"pull",setOrder:1,trackingType:"repetitions",reps:8,performedAt:"2024-01-01"},
    ]);
    expect(result.find((item)=>item.setKey==="later")?.kinds).toEqual(["reps"]);
    expect(result.flatMap((item)=>item.kinds)).not.toContain("weight");
  });
});
