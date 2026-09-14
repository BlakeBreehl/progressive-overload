import { useState,type ReactNode } from 'react';
import type { AppScreen } from '../domain/routing';
import type { ModuleState } from '../domain/modules';
import { mobileDestinations,secondaryDestinations } from '../domain/groupNavigation';
import { ConfirmDialog } from './ConfirmDialog';
export function MobileNavigation({enabled,screen,go,icon}:{enabled:ModuleState;screen:AppScreen;go:(screen:AppScreen)=>void;icon:(name:string)=>ReactNode}){
 const [open,setOpen]=useState(false),secondary=secondaryDestinations(enabled);
 return <><nav className="bottom-nav" aria-label="Primary navigation">{mobileDestinations(enabled).map(item=>{
  const active=item.key==='more'?secondary.some(destination=>destination.key===screen):item.key===screen;
  return <button key={item.key} aria-current={active?'page':undefined} aria-expanded={item.key==='more'?open:undefined} aria-haspopup={item.key==='more'?'dialog':undefined} aria-label={item.key==='more'?`More: ${secondary.map(destination=>destination.label).join(', ')}`:item.label} className={active?'text-red':'text-slate-600'} onClick={()=>item.key==='more'?setOpen(true):go(item.key)}>{icon(item.icon)}<span>{item.label}</span></button>;
 })}</nav><ConfirmDialog open={open} title="More" description="Training modules and Settings" confirmLabel="Done" cancelLabel="Close" destructive={false} onCancel={()=>setOpen(false)} onConfirm={()=>setOpen(false)}><div className="grid gap-2">{secondary.map(item=><button key={item.key} className="secondary-button justify-start" aria-current={screen===item.key?'page':undefined} onClick={()=>{setOpen(false);go(item.key);}}>{icon(item.icon)}{item.label}</button>)}</div></ConfirmDialog></>;
}
