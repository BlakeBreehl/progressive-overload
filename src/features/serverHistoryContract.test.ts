import { describe, expect, it } from "vitest";
import strength from "./strength/repository.ts?raw";
import cardio from "./cardio/repository.ts?raw";
import flex from "./flexibility/repository.ts?raw";
import weight from "./weight/repository.ts?raw";
import { historyRange } from "../lib/pagedHistory";

describe("server-side history contracts", () => {
  it("requests one 20-row range with exact counts and stable date ordering", () => {
    expect(historyRange(1)).toEqual({from:0,to:19});
    for (const source of [strength,cardio,flex,weight]) {
      expect(source).toContain("count:'exact'");
      expect(source).toContain("range(range.from,range.to)");
      expect(source).toContain("order('created_at',{ascending:false})");
      expect(source).toContain("order('id',{ascending:false})");
    }
  });
  it("applies database search and no-location filters before range", () => {
    for (const source of [strength,cardio,flex]) expect(source.indexOf("ilike(")).toBeLessThan(source.indexOf(".range(range.from,range.to)"));
    for (const source of [strength,cardio]) expect(source).toContain(".is('location_id',null)");
  });
  it("fetches complete child sets for the returned Strength workout IDs", () => {
    expect(strength).toContain(".in('id',pageIds)");
    expect(strength).toContain("sets:strength_sets!strength_set_workout_owned_fk(id,exercise_id,set_order");
  });
});
