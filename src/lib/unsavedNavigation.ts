import { useLayoutEffect, useRef } from 'react';
const checks=new Map<symbol,()=>boolean>();
export const hasUnsavedChanges=()=>[...checks.values()].some(check=>check());
export function useUnsavedForm(value:unknown,busy=false,identity:unknown=null) {
  const state=useRef<{identity:unknown;active:boolean;baseline:string;current:string;busy:boolean}>({identity:null,active:false,baseline:'',current:'',busy:false});
  const token=useRef(Symbol('form'));
  const snapshot=JSON.stringify(value);
  useLayoutEffect(()=>{
    const active=value!=null;
    if(active&&(!state.current.active||state.current.identity!==identity))state.current.baseline=snapshot;
    state.current={...state.current,identity,active,current:snapshot,busy};
    checks.set(token.current,()=>state.current.busy||(state.current.active&&state.current.current!==state.current.baseline));
  },[snapshot,value,busy,identity]);
  useLayoutEffect(()=>{const key=token.current;return()=>{checks.delete(key)}},[]);
}
