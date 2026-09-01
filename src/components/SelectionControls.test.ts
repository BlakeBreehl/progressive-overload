import { describe, expect, it } from "vitest";
import controls from "./SelectionControls.tsx?raw";

describe("selection controls", () => {
  it("supports keyboard selection, cancellation, and disabled options", () => {
    expect(controls).toContain('event.key === "ArrowDown"');
    expect(controls).toContain('event.key === "ArrowUp"');
    expect(controls).toContain('event.key === "Enter"');
    expect(controls).toContain('event.key === "Escape"');
    expect(controls).toContain("!option.disabled");
    expect(controls).toContain("onChange(option.value)");
  });

  it("exposes combobox filtering and multi-select semantics", () => {
    expect(controls).toContain('role="combobox"');
    expect(controls).toContain(".includes(query.toLowerCase())");
    expect(controls).toContain('aria-multiselectable="true"');
    expect(controls).toContain("createPortal(");
  });
});
