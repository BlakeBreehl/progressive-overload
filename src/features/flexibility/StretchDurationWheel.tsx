import { WheelColumn } from "../../components/WheelColumn";
import {
  stretchDurationParts,
  stretchDurationSeconds,
} from "./stretchDuration";
type Props = {
  value?: number;
  minutes?: number;
  seconds?: number;
  onChange: (value: any) => void;
  label?: string;
  compact?: boolean;
};
export function StretchDurationWheel({
  value,
  minutes = 0,
  seconds = 0,
  onChange,
  label = "Stretch duration",
}: Props) {
  const legacy = value === undefined,
    parts = stretchDurationParts(
      Math.min(
        5999,
        Math.max(0, value ?? stretchDurationSeconds(minutes, seconds)),
      ),
    ),
    emit = (next: number) =>
      onChange(legacy ? { hours: 0, ...stretchDurationParts(next) } : next);
  return (
    <fieldset
      className="duration-wheel duration-wheel-compact"
      data-duration-mode="stretch"
    >
      <legend>{label}</legend>
      <output aria-live="polite">
        {String(parts.minutes).padStart(2, "0")}:
        {String(parts.seconds).padStart(2, "0")}
      </output>
      <div className="duration-columns duration-columns-stretch">
        <WheelColumn
          compact
          label={`${label} Minutes`}
          value={parts.minutes}
          max={99}
          onChange={(next) => emit(stretchDurationSeconds(next, parts.seconds))}
        />
        <WheelColumn
          compact
          label={`${label} Seconds`}
          value={parts.seconds}
          max={59}
          onChange={(next) => emit(stretchDurationSeconds(parts.minutes, next))}
        />
      </div>
      <div
        className="duration-labels duration-labels-stretch"
        aria-hidden="true"
      >
        <span>MM</span>
        <span>SS</span>
      </div>
    </fieldset>
  );
}
