import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfirmDialog } from './ConfirmDialog';
import { acknowledgeRelease, shouldAnnounce, subscribeReleaseDismissal } from '../lib/releaseAnnouncement';
type ReleaseProps={client:SupabaseClient;userId:string;ready:boolean;onLeaderboards:()=>void};
export function ReleaseAnnouncement(props:ReleaseProps){
  return props.ready&&props.userId?<AccountReleaseAnnouncement key={props.userId} {...props}/>:null;
}
function AccountReleaseAnnouncement({client,userId,ready,onLeaderboards}:ReleaseProps){
  const mounted=useRef(false);
  const submitting=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [open,setOpen]=useState(false),[request,setRequest]=useState<'automatic'|'manual'|null>(null);
  const [loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true, dismissed=false;
    const unsubscribe=subscribeReleaseDismissal(userId,()=>{dismissed=true;if(active){setOpen(false);setRequest(null);setError('');}});
    if(ready)void shouldAnnounce(client,userId,true).then(show=>{if(active){setLoaded(true);if(show&&!dismissed)setRequest('automatic');}}).catch(()=>{if(active)setError('Could not check the release announcement. Please retry.');});
    return()=>{active=false;unsubscribe();};
  },[client,userId,ready,retry]);
  useEffect(()=>{const reopen=()=>{if(loaded&&ready)setRequest('manual');};window.addEventListener('open-release-announcement',reopen);return()=>window.removeEventListener('open-release-announcement',reopen);},[loaded,ready]);
  useEffect(()=>{
    if(!ready||!loaded||!request)return;
    let presented=false;
    const show=()=>{if(presented||document.querySelector('[role="dialog"],[role="alertdialog"]'))return;presented=true;setOpen(true);};
    const observer=new MutationObserver(show);observer.observe(document.body,{childList:true,subtree:true});show();return()=>observer.disconnect();
  },[ready,loaded,request]);
  const close=async()=>{
    if(submitting.current)return false;
    if(request==='manual'){setOpen(false);setRequest(null);return true;}
    submitting.current=true;setBusy(true);setError('');
    try{await acknowledgeRelease(client,userId);if(!mounted.current)return false;setOpen(false);setRequest(null);return true;}
    catch{if(mounted.current)setError('Could not save your dismissal. Please retry.');return false;}
    finally{submitting.current=false;if(mounted.current)setBusy(false);}
  };
  if(ready&&!loaded&&error)return <div role="status" className="fixed bottom-4 inset-x-4 z-50 rounded-xl bg-white p-4 shadow-xl"><p>{error}</p><button className="secondary-button mt-2" onClick={()=>{setError('');setRetry(value=>value+1);}}>Retry</button></div>;
  return <ConfirmDialog open={ready&&loaded&&open} title="Progressive Overload 2.1" description="Every step. Every rep. More ways to see your progress." confirmLabel={error?'Retry dismissal':'Explore 2.1'} cancelLabel="Close" busy={busy} error={error} destructive={false} onCancel={()=>{void close();}} onConfirm={async()=>{await close();}}>
    <div className="release-hero"><span className="eyebrow">PROGRESSIVE OVERLOAD 2.1</span><h3 className="mt-2 text-3xl font-black">Every step forward.</h3><p className="mt-3 text-sm">Your effort deserves a clearer picture.</p><button className="primary-button mt-4" disabled={busy} onClick={async()=>{if(await close())onLeaderboards();}}>View Leaderboards</button></div>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">{[
      ['↗','Count your steps','Manual Cardio steps and daily, weekly, and monthly step Progress.'],
      ['#','A clear place','Clean sequential Leaderboard ranks, even when totals tie.'],
      ['↻','Ready to train','Improved login recovery and retry controls.'],
      ['▥','See your consistency','Weekly and Monthly muscle trends with clear calendar buckets.'],
      ['●','Every milestone','Rep Weight charts track your qualifying 4+ rep progression.'],
      ['↓','Less assistance. More progress.','Assisted Dip, Pull Up, and Chin Up with lower-assistance PRs.'],
      ['✓','Triceps get the credit','Dip, Weighted Dip, and Assisted Dip count toward Arms.']
    ].map(([icon,title,copy])=><li key={title} className="rounded-xl border border-slate-200 p-3"><span aria-hidden="true" className="text-xl font-black text-red">{icon}</span><h4 className="font-bold text-ink">{title}</h4><p className="mt-1 text-sm">{copy}</p></li>)}</ul>
  </ConfirmDialog>;
}
