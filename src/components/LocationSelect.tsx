import { useUnsavedForm } from '../lib/unsavedNavigation';
import { findOrCreateLocation } from '../lib/locationCreation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Combobox } from './SelectionControls';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabase';
import { getLocations } from '../features/strength/repository';
export function LocationSelect(props:ComponentProps<typeof Combobox>) {
  const {session}=useAuth(),userId=session?.user.id;
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const submitting=useRef(false);
  useUnsavedForm(open?name:null,busy);
  const [added,setAdded]=useState<Array<{value:string;label:string}>>([]);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(supabase&&userId)void getLocations(supabase,userId).then(locations=>{if(active)setAdded(locations.filter(location=>!location.archived).map(location=>({value:location.id,label:location.name})));}).catch(()=>{});};
    const changed=(event:Event)=>{if((event as CustomEvent<string>).detail===userId)refresh();};
    refresh();window.addEventListener('locations-changed',changed);return()=>{active=false;window.removeEventListener('locations-changed',changed);};
  },[userId]);
  return <div><Combobox {...props} options={[...props.options,...added.filter(item=>!props.options.some(option=>option.value===item.value))]} action={{label:'+ Add new location',onClick:()=>{setError('');setOpen(true)}}}/>{notice&&<p role="status" className="mt-2 text-sm">{notice}</p>}
    <ConfirmDialog open={open} title="Add new location" description="Save a private location and use it for this entry." confirmLabel="Save location" destructive={false} busy={busy} error={error} onCancel={()=>setOpen(false)} onConfirm={async()=>{
      if(submitting.current)return;
      if(!supabase||!userId){setError('Sign in again to save this location. Your entry is preserved.');return;}
      submitting.current=true;setBusy(true);setError('');
      try {const result=await findOrCreateLocation(supabase,userId,name);setAdded(current=>[...current.filter(item=>item.value!==result.id),{value:result.id,label:result.name}]);props.onChange(result.id);setNotice(result.existing?'This location was already available and has been selected.':'Location saved.');window.dispatchEvent(new CustomEvent('locations-changed',{detail:userId}));setName('');setOpen(false);}
      catch{setError('Could not save this location. Your name and entry are preserved; please retry.');}
      finally{submitting.current=false;setBusy(false);}
    }}><label className="field-label">Location name<input className="field-input" value={name} onChange={event=>setName(event.target.value)}/></label></ConfirmDialog>
  </div>;
}
