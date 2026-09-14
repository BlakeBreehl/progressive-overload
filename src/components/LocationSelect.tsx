import { useEffect, useState, type ComponentProps } from 'react';
import { Combobox } from './SelectionControls';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabase';
import { getLocations, saveLocation } from '../features/strength/repository';

export function LocationSelect(props: ComponentProps<typeof Combobox>) {
  const { session } = useAuth();
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [added,setAdded]=useState<Array<{value:string;label:string}>>([]);
  const userId=session?.user.id;
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(supabase&&userId)void getLocations(supabase,userId).then(locations=>{if(active)setAdded(locations.filter(location=>!location.archived).map(location=>({value:location.id,label:location.name})));}).catch(()=>{/* Existing choices remain usable while offline. */});};
    const changed=(event:Event)=>{if((event as CustomEvent<string>).detail===userId)refresh();};
    refresh();window.addEventListener('locations-changed',changed);
    return()=>{active=false;window.removeEventListener('locations-changed',changed);};
  },[userId]);
  return <div><Combobox {...props} options={[...props.options,...added.filter(item=>!props.options.some(option=>option.value===item.value))]} />
    <button type="button" className="text-button mt-2" onClick={()=>{setError('');setOpen(true)}}>+ Add new location</button>
    <ConfirmDialog open={open} title="Add new location" description="Save a private location and use it for this entry." confirmLabel="Save location" destructive={false} busy={busy} error={error} onCancel={()=>setOpen(false)} onConfirm={async()=>{
      if(!supabase||!session||busy)return;
      if(!name.trim()){setError('Enter a location name.');return;}
      setBusy(true);setError('');
      try {
        const id=await saveLocation(supabase,session.user.id,name);
        setAdded(current=>[...current,{value:id,label:name.trim()}]);
        window.dispatchEvent(new CustomEvent('locations-changed',{detail:session.user.id}));
        props.onChange(id);setName('');setOpen(false);
      } catch {setError('Could not save. Check your connection and use a unique name, then retry. Your entry is preserved.');}
      finally{setBusy(false);}
    }}><label className="field-label">Location name<input className="field-input" value={name} onChange={event=>setName(event.target.value)} /></label></ConfirmDialog>
  </div>;
}
