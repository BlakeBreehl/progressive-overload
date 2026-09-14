import { useEffect, useRef, useId } from "react";
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
  const id=useId(),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const ref = useRef<HTMLDivElement>(null),
    values = Array.from({ length: max + 1 }, (_, i) => i);
  useEffect(() => {
    const column=ref.current,row=column?.querySelector<HTMLElement>('[data-value]');
    if(column&&row)column.scrollTop=value*row.offsetHeight;
  }, [value]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const move = (delta: number) =>
    onChange(Math.max(0, Math.min(max, value + delta)));
  return (
    <div
      ref={ref}
      className={`wheel-column ${compact ? "wheel-column-compact" : ""}`}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${id}-${value}`}
      onScroll={()=>{
        if(timer.current)clearTimeout(timer.current);
        timer.current=setTimeout(()=>{
          const column=ref.current,row=column?.querySelector<HTMLElement>('[data-value]');
          if(column&&row){const next=Math.max(0,Math.min(max,Math.round(column.scrollTop/row.offsetHeight)));if(next!==value)onChange(next);}
        },120);
      }}
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
          id={`${id}-${option}`}
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
