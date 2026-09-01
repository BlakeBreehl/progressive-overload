import { describe, expect, it } from "vitest";
import { calendarDateKey, chronological, localDateLabel, normalizeSearch, paginate, validPage } from "./history";
const scrambled = ["2024-12-31", "2023-12-31", "2025-01-01", "2024-04-01", "2024-01-01", "2024-02-01"];
describe("history and calendar ordering", () => {
  it("ignores creation order and sorts calendar dates chronologically", () => expect(chronological(scrambled, value => value)).toEqual(["2023-12-31", "2024-01-01", "2024-02-01", "2024-04-01", "2024-12-31", "2025-01-01"]));
  it("preserves January 1 as a local calendar date", () => { expect(calendarDateKey("2024-01-01")).toBe("2024-01-01"); expect(localDateLabel("2024-01-01")).toMatch(/1\/1\/2024|01\/01\/2024/); });
  it("normalizes case and repeated whitespace", () => expect(normalizeSearch("  Bench   PRESS ")).toBe("bench press"));
  it("searches before pagination and clamps a deleted last page", () => { const rows = Array.from({ length: 45 }, (_, id) => ({ id, name: id === 40 ? "Bench Press" : "Squat" })); const matches = rows.filter(row => normalizeSearch(row.name).includes(normalizeSearch("bench press"))); expect(paginate(matches, 1).items[0].id).toBe(40); expect(validPage(3, 40)).toBe(2); expect(paginate(rows, 1).items).toHaveLength(20); });
});
