import { useId, useState } from 'react';
export function CollapsibleNotes({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  const id=useId(),[open,setOpen]=useState(Boolean(value));
  return <div className="col-span-2 mt-3"><button type="button" className="notes-toggle" aria-label={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(current=>!current)}><span aria-hidden="true" className={`notes-chevron ${open?'notes-chevron-open':''}`}>&rsaquo;</span>{label}</button><div id={id} hidden={!open}><label className="field-label"><span className="sr-only">{label}</span><textarea className="field-input min-h-20 py-3" value={value} onChange={event=>onChange(event.target.value)}/></label></div></div>;
}
