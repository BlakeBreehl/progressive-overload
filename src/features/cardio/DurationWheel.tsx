import { WheelColumn } from "../../components/WheelColumn";
type Parts = { hours: number; minutes: number; seconds: number };
export function DurationWheel({
  hours,
  minutes,
  seconds,
  onChange,
  label = "Duration",
  compact = false,
}: {
  hours: number;
  minutes: number;
  seconds: number;
  onChange: (value: Parts) => void;
  label?: string;
  compact?: boolean;
}) {
  const parts = [
    { label: "Hours", value: hours, max: 99, key: "hours" as const },
    { label: "Minutes", value: minutes, max: 59, key: "minutes" as const },
    { label: "Seconds", value: seconds, max: 59, key: "seconds" as const },
  ];
  return (
    <fieldset
      className={`duration-wheel${compact ? " duration-wheel-compact" : ""}`}
      data-duration-mode="cardio"
    >
      <legend>{label}</legend>
      <output aria-live="polite">
        {[hours, minutes, seconds]
          .map((x) => String(x).padStart(2, "0"))
          .join(":")}
      </output>
      <div className="duration-columns">
        {parts.map((part) => (
          <WheelColumn
            compact={compact}
            key={part.key}
            label={`${label} ${part.label}`}
            value={part.value}
            max={part.max}
            onChange={(next) =>
              onChange({ hours, minutes, seconds, [part.key]: next })
            }
          />
        ))}
      </div>
      <div className="duration-labels" aria-hidden="true">
        <span>HH</span>
        <span>MM</span>
        <span>SS</span>
      </div>
    </fieldset>
  );
}
