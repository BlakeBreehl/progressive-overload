import { useEffect, useRef } from "react";
export function WheelColumn({
  label,
  value,
  max,
  onChange,
  compact = false,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    values = Array.from({ length: max + 1 }, (_, i) => i);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(`[data-value="${value}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [value]);
  const move = (delta: number) =>
    onChange(Math.max(0, Math.min(max, value + delta)));
  return (
    <div
      ref={ref}
      className={`wheel-column ${compact ? "wheel-column-compact" : ""}`}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${label.replace(/\W/g, "-")}-${value}`}
      onWheel={(event) => {
        event.preventDefault();
        move(event.deltaY > 0 ? 1 : -1);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(0);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(max);
        }
      }}
    >
      {values.map((option) => (
        <button
          id={`${label.replace(/\W/g, "-")}-${option}`}
          data-value={option}
          type="button"
          role="option"
          aria-selected={option === value}
          tabIndex={-1}
          className="wheel-option"
          onClick={() => onChange(option)}
          key={option}
        >
          {String(option).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}
