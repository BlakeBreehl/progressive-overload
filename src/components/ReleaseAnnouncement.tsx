import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfirmDialog } from './ConfirmDialog';
import { acknowledgeRelease, markShown, shouldAnnounce } from '../lib/releaseAnnouncement';
export function ReleaseAnnouncement({client,userId,ready,onLeaderboards}:{client:SupabaseClient;userId:string;ready:boolean;onLeaderboards:()=>void}){
  const [open,setOpen]=useState(false),[request,setRequest]=useState<'automatic'|'manual'|null>(null);
  useEffect(()=>{let active=true;shouldAnnounce(client,userId,ready).then(show=>{if(active&&show)setRequest(current=>current??'automatic');}).catch(()=>{});return()=>{active=false;};},[client,userId,ready]);
  useEffect(()=>{const reopen=()=>setRequest('manual');window.addEventListener('open-release-announcement',reopen);return()=>window.removeEventListener('open-release-announcement',reopen);},[]);
  useEffect(()=>{
    if(!ready||!request)return;
    const show=()=>{if(document.querySelector('[role="dialog"],[role="alertdialog"]'))return; if(request==='automatic')markShown(userId);setOpen(true);};
    const observer=new MutationObserver(show);observer.observe(document.body,{childList:true,subtree:true});show();return()=>observer.disconnect();
  },[ready,request,userId]);
  const close=()=>{setOpen(false);setRequest(null);if(request==='automatic')void acknowledgeRelease(client,userId);};
  return <ConfirmDialog open={ready&&open} title="Progressive Overload 2.0" description="Your progress. Your people. A new reason to show up." confirmLabel="Explore 2.0" cancelLabel="Close" destructive={false} onCancel={close} onConfirm={close}>
    <div className="release-hero"><span className="eyebrow">TRAIN TOGETHER</span><h3 className="mt-2 text-2xl font-black">Private Groups.<br/>Real competition.</h3><p className="mt-3 text-sm">Invite your people. Chase the most sets, race for real PRs, and compare Strength and Cardio on your private Leaderboards.</p><button className="primary-button mt-4" onClick={()=>{close();onLeaderboards();}}>View Leaderboards</button></div>
    <ul className="mt-4 space-y-2 text-sm"><li><strong>Every rep counts.</strong> Blue Rep PR and green Weight PR indicators, grounded in recorded sets.</li><li><strong>See the whole picture.</strong> A weekly Bodyweight change table, mixed pounds/kilograms display support, and connected Morning/Evening lines.</li><li><strong>Move faster.</strong> Improved Progress controls, searchable histories, and improved mobile navigation.</li></ul>
    <p className="mt-3 text-xs text-slate-500">Groups are opt-in. Notes, locations, and Bodyweight stay private.</p>
  </ConfirmDialog>;
}
