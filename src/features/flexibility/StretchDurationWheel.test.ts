import { describe, expect, it } from "vitest";
import raw from "./StretchDurationWheel.tsx?raw";
import column from "../../components/WheelColumn.tsx?raw";
import flexRaw from "./FlexibilityFeature.tsx?raw";
import { stretchDurationParts, stretchDurationSeconds, validStretchDuration } from "./stretchDuration";

describe("Stretch MM:SS wheel", () => {
  it("has exactly two wheel columns and no hours control", () => {
    expect(raw.match(/<WheelColumn/g)).toHaveLength(2);
    expect(raw).toContain("parts.minutes");
    expect(raw).toContain("parts.seconds");
    expect(raw).not.toContain("hours?:");
    expect(raw).toContain("duration-columns-stretch");
  });
  it("enforces limits", () => {
    expect(validStretchDuration(0)).toBe(false);
    expect(validStretchDuration(1)).toBe(true);
    expect(validStretchDuration(5999)).toBe(true);
    expect(validStretchDuration(6000)).toBe(false);
  });
  it("restores duration", () => {
    expect(stretchDurationSeconds(1, 12)).toBe(72);
    expect(stretchDurationParts(72)).toEqual({ minutes: 1, seconds: 12 });
    expect(stretchDurationParts(5999)).toEqual({ minutes: 99, seconds: 59 });
    expect(stretchDurationSeconds(99, 59)).toBe(5999);
  });
  it("uses independent wheels for every Time set", () => {
    expect(flexRaw).toContain('selected.trackingType === "time"');
    expect(flexRaw).toContain("form.sets.map");
    expect(flexRaw).toContain("<DurationWheel");
  });
  it("supports mouse wheel and keyboard selection", () => {
    expect(column).toContain("onWheel=");
    expect(column).toContain("onKeyDown=");
    expect(column).toContain("aria-selected={option === value}");
  });
});
