import { describe, expect, it } from "vitest";
import wheel from "./DurationWheel.tsx?raw";
import column from "../../components/WheelColumn.tsx?raw";
import draftRaw from "./entryDraft.ts?raw";
import cardioRaw from "./CardioFeature.tsx?raw";
import { durationParts, durationToSeconds, validateCardio } from "./logic";

describe("duration wheel integration", () => {
  it("is used for Cardio create and edit state", () => {
    expect(cardioRaw).toContain("<DurationWheel");
    expect(cardioRaw).toContain("cardioEditDraft(entry)");
    expect(draftRaw).toContain("durationParts(entry.durationSeconds)");
  });
  it("keeps Cardio as HH:MM:SS", () => {
    expect(wheel).toContain('{ label: "Hours"');
    expect(wheel).toContain('{ label: "Minutes"');
    expect(wheel).toContain('{ label: "Seconds"');
    expect(wheel).toContain("<span>HH</span>");
  });
  it("uses custom scrolling, keyboard-accessible listboxes", () => {
    expect(column).toContain('role="listbox"');
    expect(column).toContain("onWheel=");
    expect(column).toContain('event.key === "ArrowUp"');
    expect(column).toContain('event.key === "ArrowDown"');
    expect(column).toContain('role="option"');
    expect(wheel).not.toContain("<select");
  });
  it("handles duration limits and edit restoration", () => {
    expect(validateCardio({ activityName: "Running", hours: 0, minutes: 0, seconds: 0 })).not.toEqual([]);
    expect(validateCardio({ activityName: "Running", hours: 99, minutes: 59, seconds: 59 })).toEqual([]);
    expect(durationToSeconds(99, 59, 59)).toBe(359999);
    expect(durationParts(359999)).toEqual({ hours: 99, minutes: 59, seconds: 59 });
  });
});
