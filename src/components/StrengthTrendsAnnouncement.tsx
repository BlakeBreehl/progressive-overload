import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ConfirmDialog} from './ConfirmDialog';
import {watchConnectionRecovery} from '../lib/connectionRecovery';
import {dismissStrengthReleaseLocally,reconcileStrengthRelease,shouldShowStrengthRelease,strengthReleaseEligible,subscribeStrengthReleaseDismissal} from '../lib/strengthTrendsRelease';
export function StrengthTrendsAnnouncement({client,userId,ready}:{client:SupabaseClient;userId:string;ready:boolean}){
 return strengthReleaseEligible(ready,userId,location.pathname)?<AccountAnnouncement key={userId} client={client} userId={userId}/>:null;
}
function AccountAnnouncement({client,userId}:{client:SupabaseClient;userId:string}){
 const [requested,setRequested]=useState(false),[open,setOpen]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true,dismissed=false;
  const off=subscribeStrengthReleaseDismissal(userId,()=>{dismissed=true;if(active){setOpen(false);setRequested(false);}});
  void shouldShowStrengthRelease(client,userId,true,location.pathname).then(show=>{if(active&&show&&!dismissed)setRequested(true);}).catch(()=>{});
  const retry=watchConnectionRecovery(()=>setAttempt(value=>value+1));
  return()=>{active=false;off();retry();};
 },[client,userId,attempt]);
 useEffect(()=>{if(!requested)return;let active=true;const show=()=>{if(active&&!document.querySelector('[role="dialog"],[role="alertdialog"]'))setOpen(true);};const observer=new MutationObserver(show);observer.observe(document.body,{childList:true,subtree:true});show();return()=>{active=false;observer.disconnect();};},[requested]);
 useEffect(()=>{const manual=()=>setRequested(true);window.addEventListener('open-release-announcement',manual);return()=>window.removeEventListener('open-release-announcement',manual);},[]);
 const dismiss=()=>{dismissStrengthReleaseLocally(userId);setOpen(false);setRequested(false);void reconcileStrengthRelease(client,userId).catch(()=>{});};
 return <ConfirmDialog open={open} title="Progressive Overload 2.3" description="See your consistency. Find your next breakthrough." confirmLabel="Let's train" singleAction destructive={false} onCancel={dismiss} onConfirm={dismiss} icon={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>}>
  <div className="strength-release-hero"><span className="eyebrow">STRONGER TRENDS. CLEARER PROGRESS.</span><h3 className="mt-2 text-2xl font-black">Every month tells your story.</h3><p className="mt-2 text-sm">Continuous muscle-group totals make consistency easy to see.</p></div>
  <ul className="strength-release-highlights"><li><strong>Choose your view</strong><span>3 months, 6 months, a year, All Time, or the past 6 weeks.</span></li><li><strong>Focus on your training</strong><span>Toggle muscle groups. The chart automatically zooms to the visible totals.</span></li><li><strong>Celebrate your PRs</strong><span>Compact green Weight PR and blue Rep PR summaries beside Your Sets.</span></li></ul>
 </ConfirmDialog>;
}
