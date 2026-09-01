import { describe, expect, it } from "vitest";
import { normalizeExerciseName } from "./logic";
import { planStarterSeed, starterExercises } from "./starterLibrary";

describe("private starter library v2", () => {
  it("contains every canonical name once", () => {
    expect(starterExercises).toHaveLength(119);
    expect(new Set(starterExercises.map((item) => normalizeExerciseName(item.name))).size).toBe(119);
    expect(starterExercises.map((item) => item.name)).toEqual(expect.arrayContaining(["Squat", "Dumbbell Bench Press", "Dip", "Weighted Dip"]));
  });
  it("marks bodyweight movements reps-only and weighted variants weight-plus-reps", () => {
    for (const name of ["Pull Up", "Chin Up", "Dip", "Push Up", "Leg Lift"])
      expect(starterExercises.find((item) => item.name === name)?.loadMode).toBe("reps_only");
    for (const name of ["Weighted Pull Up", "Weighted Chin Up", "Weighted Dip"])
      expect(starterExercises.find((item) => item.name === name)?.loadMode).not.toBe("reps_only");
  });
  it("normalizes duplicates and remains idempotent", () => {
    const remaining = planStarterSeed([" squat ", "DIP", " weighted   pull up "], false);
    expect(remaining.find((item) => item.name === "Squat")).toBeUndefined();
    expect(remaining.find((item) => item.name === "Dip")).toBeUndefined();
    expect(remaining.find((item) => item.name === "Weighted Pull Up")).toBeUndefined();
    expect(planStarterSeed([], true)).toEqual([]);
  });
});
