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
export function Combobox({label,value,options,onChange,placeholder='Search...',disabled=false,footer,autoFocus=false,action}: {
  label:string;value:string;options:SelectOption[];onChange:(value:string)=>void;placeholder?:string;disabled?:boolean;footer?:ReactNode;autoFocus?:boolean;action?:{label:string;onClick:()=>void};
}) {
  const inputRef=useRef<HTMLInputElement>(null),actionRef=useRef<HTMLButtonElement>(null);
  const [id]=useState(()=>crypto.randomUUID()),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0),[menuStyle,setMenuStyle]=useState<ReturnType<typeof position>>({});
  const filtered=useMemo(()=>options.filter(option=>(option.label+' '+(option.description??'')).toLowerCase().includes(query.toLowerCase())),[options,query]);
  const selected=options.find(option=>option.value===value);
  useMenuPosition(open,inputRef,setMenuStyle);
  const close=()=>{setOpen(false);setQuery('');};
  const choose=(option:SelectOption)=>{onChange(option.value);close();inputRef.current?.focus();};
  const activateAction=()=>{close();inputRef.current?.focus();action?.onClick();};
  const enabled=filtered.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);
  if(action)enabled.push(filtered.length);
  const move=(direction:number)=>{const at=enabled.indexOf(active),next=enabled[Math.max(0,Math.min(enabled.length-1,at+direction))]??0;setActive(next);if(action&&next===filtered.length)actionRef.current?.focus();else inputRef.current?.focus();};
  return <div className="combobox-control" onKeyDown={event=>{
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();inputRef.current?.focus();}
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){setMenuStyle(position(inputRef.current));setOpen(true);setActive(enabled[0]??0);}else move(event.key==='ArrowDown'?1:-1);}
    else if(open&&event.key==='Enter'&&event.target===inputRef.current){event.preventDefault();if(action&&active===filtered.length)activateAction();else if(filtered[active]&&!filtered[active].disabled)choose(filtered[active]);}
  }}>
    <label className="field-label" id={`${id}-label`}>{label}<input ref={inputRef} autoComplete="off" enterKeyHint="search" autoFocus={autoFocus} className="field-input" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&active<filtered.length?`${id}-${active}`:undefined} aria-autocomplete="list" disabled={disabled} placeholder={selected?.label??placeholder} value={query} onClick={()=>{setMenuStyle(position(inputRef.current));setOpen(true);}} onChange={event=>{setQuery(event.target.value);setActive(0);setMenuStyle(position(event.currentTarget));setOpen(true);}}/></label>
    {open&&createPortal(<><button type="button" className="select-dismiss" aria-label={`Close ${label} options`} onClick={close}/><div className="combobox-menu" style={menuStyle}><div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
      {filtered.map((option,index)=><button id={`${id}-${index}`} type="button" role="option" aria-selected={option.value===value} disabled={option.disabled} className={`select-option ${active===index?'select-option-active':''}`} key={option.value} onClick={()=>choose(option)}><span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>{option.value===value&&<span aria-hidden="true">&#10003;</span>}</button>)}
      {!filtered.length&&<p className="p-3 text-sm text-slate-500">No matches.</p>}
    </div>{action&&<button ref={actionRef} type="button" className="select-option sticky bottom-0 bg-white text-red" aria-label={action.label} onClick={activateAction}>{action.label}</button>}{footer}</div></>,document.body)}
  </div>;
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
