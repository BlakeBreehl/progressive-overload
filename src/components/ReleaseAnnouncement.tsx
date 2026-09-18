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
    if(busy)return false;
    setBusy(true);setError('');
    try{await acknowledgeRelease(client,userId);if(!mounted.current)return false;setOpen(false);setRequest(null);return true;}
    catch{setError('Could not save your dismissal. Please retry.');return false;}
    finally{setBusy(false);}
  };
  if(ready&&!loaded&&error)return <div role="status" className="fixed bottom-4 inset-x-4 z-50 rounded-xl bg-white p-4 shadow-xl"><p>{error}</p><button className="secondary-button mt-2" onClick={()=>{setError('');setRetry(value=>value+1);}}>Retry</button></div>;
  return <ConfirmDialog open={ready&&loaded&&open} title="Progressive Overload 2.0" description="Your progress. Your people. A new reason to show up." confirmLabel={error?'Retry dismissal':'Explore 2.0'} cancelLabel="Close" busy={busy} error={error} destructive={false} onCancel={()=>{void close();}} onConfirm={async()=>{await close();}}>
    <div className="release-hero"><span className="eyebrow">TRAIN TOGETHER</span><h3 className="mt-2 text-2xl font-black">Private Groups.<br/>Real competition.</h3><p className="mt-3 text-sm">Invite your people. Chase the most sets, race for real PRs, and compare Strength and Cardio on your private Leaderboards.</p><button className="primary-button mt-4" disabled={busy} onClick={async()=>{if(await close())onLeaderboards();}}>View Leaderboards</button></div>
    <ul className="mt-4 space-y-2 text-sm"><li><strong>Easy short Group Codes.</strong> Invite friends to private Groups and compare Strength and Cardio on Leaderboards.</li><li><strong>Optional progress-sharing privacy.</strong> Choose whether your totals appear in group Leaderboards; notes, locations, Bodyweight, and raw workouts stay private.</li><li><strong>Every rep counts.</strong> Blue Rep PR and green Weight PR indicators, grounded in recorded sets.</li><li><strong>See the whole picture.</strong> Improved Strength Progress, weekly Bodyweight summaries, including the weekly Bodyweight change table, mixed pounds/kilograms display support, and connected Morning/Evening lines.</li><li><strong>Move faster.</strong> Improved Progress controls, searchable histories, and improved mobile navigation.</li></ul>
  </ConfirmDialog>;
}
