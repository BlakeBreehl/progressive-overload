import {menuPosition} from "./menuPosition";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};
const position = (node: HTMLElement | null) => {
  const r = node?.getBoundingClientRect();
  if (!r) return {};
  const viewport=window.visualViewport;
  return menuPosition(r,{left:viewport?.offsetLeft??0,top:viewport?.offsetTop??0,width:viewport?.width??innerWidth,height:viewport?.height??innerHeight,layoutHeight:innerHeight});
};
function useMenuPosition(open:boolean,anchor:RefObject<HTMLElement|null>,update:Dispatch<SetStateAction<ReturnType<typeof position>>>){
  useEffect(()=>{if(!open)return;const sync=()=>update(position(anchor.current));sync();window.addEventListener('resize',sync);window.addEventListener('scroll',sync,true);window.visualViewport?.addEventListener('resize',sync);window.visualViewport?.addEventListener('scroll',sync);return()=>{window.removeEventListener('resize',sync);window.removeEventListener('scroll',sync,true);window.visualViewport?.removeEventListener('resize',sync);window.visualViewport?.removeEventListener('scroll',sync);};},[open,anchor,update]);
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Choose an option",
  className = "",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [id] = useState(() => crypto.randomUUID()),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [menuStyle, setMenuStyle] = useState<ReturnType<typeof position>>({}),
    trigger = useRef<HTMLButtonElement>(null),
    selected = options.find((x) => x.value === value),
    enabled = options
      .map((x, i) => (!x.disabled ? i : -1))
      .filter((i) => i >= 0);
  useMenuPosition(open,trigger,setMenuStyle);
  const prepareMenu = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value && !option.disabled),
      ),
    );
    setMenuStyle(position(trigger.current));
  };
  const key = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (
      !open &&
      (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      prepareMenu();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(enabled[0] ?? 0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(enabled.at(-1) ?? 0);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const at = Math.max(0, enabled.indexOf(active)),
        next =
          event.key === "ArrowDown"
            ? Math.min(enabled.length - 1, at + 1)
            : Math.max(0, at - 1);
      setActive(enabled[next] ?? 0);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[active];
      if (option && !option.disabled) {
        onChange(option.value);
        setOpen(false);
        trigger.current?.focus();
      }
    }
  };
  return (
    <div className={`custom-select ${className}`} onKeyDown={key}>
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => {
          if (!open) prepareMenu();
          setOpen((current) => !current);
        }}
      >
        <span className={selected ? "" : "text-slate-500"}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <>
            <button
              className="select-dismiss"
              aria-label="Close options"
              onClick={() => setOpen(false)}
            />
            <div
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={`${id}-label`}
              className="select-menu"
              style={menuStyle}
            >
              {options.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  className={`select-option ${index === active ? "select-option-active" : ""}`}
                  key={option.value}
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {option.value === value && (
                    <span className="text-red" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Search…",
  disabled = false,
  footer,
  autoFocus = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  footer?: ReactNode;
  autoFocus?: boolean;
}) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [menuStyle, setMenuStyle] = useState<ReturnType<typeof position>>({}),
    filtered = useMemo(
      () =>
        options.filter((x) =>
          (x.label + " " + (x.description ?? ""))
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      [options, query],
    ),
    selected = options.find((x) => x.value === value);
  useMenuPosition(!!query,inputRef,setMenuStyle);
  return (
    <div className="combobox-control">
      <label className="field-label">
        {label}
        <input
          ref={inputRef}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          className="field-input"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={selected?.label ?? placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMenuStyle(position(e.currentTarget));
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
            if (
              event.key === "Enter" &&
              filtered.length === 1 &&
              !filtered[0].disabled
            ) {
              event.preventDefault();
              onChange(filtered[0].value);
              setQuery("");
            }
          }}
        />
      </label>
      {query &&
        createPortal(
          <div role="listbox" className="combobox-menu" style={menuStyle}>
          {filtered.map((option) => (
            <button
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className="select-option"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setQuery("");
              }}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === value && <span className="text-red">✓</span>}
            </button>
          ))}
          {!filtered.length && (
            <div className="p-3 text-sm text-slate-500">No matches.</div>
          )}
          {footer}
          </div>,
          document.body,
        )}
    </div>
  );
}
export function MultiSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
}) {
  const [id] = useState(() => crypto.randomUUID()),
    [open, setOpen] = useState(false),
    [menuStyle, setMenuStyle] = useState<ReturnType<typeof position>>({}),
    button = useRef<HTMLButtonElement>(null);
  useMenuPosition(open,button,setMenuStyle);
  return (
    <div className="custom-select">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={button}
        className="select-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!open) setMenuStyle(position(button.current));
          setOpen((current) => !current);
        }}
      >
        {values.length ? `${values.length} selected` : "Choose options"}
        <span>⌄</span>
      </button>
      {open &&
        createPortal(
          <>
            <button
              className="select-dismiss"
              aria-label="Close options"
              onClick={() => setOpen(false)}
            />
            <div
              className="select-menu"
              role="listbox"
              aria-multiselectable="true"
              aria-labelledby={`${id}-label`}
              style={menuStyle}
            >
              {options.map((option) => (
                <button
                  role="option"
                  aria-selected={values.includes(option.value)}
                  disabled={option.disabled}
                  className="select-option"
                  key={option.value}
                  onClick={() =>
                    onChange(
                      values.includes(option.value)
                        ? values.filter((x) => x !== option.value)
                        : [...values, option.value],
                    )
                  }
                >
                  {option.label}
                  {values.includes(option.value) && (
                    <span className="text-red">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
