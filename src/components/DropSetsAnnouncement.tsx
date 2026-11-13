import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ConfirmDialog} from './ConfirmDialog';
import {watchConnectionRecovery} from '../lib/connectionRecovery';
import {dropSetsRelease} from '../lib/dropSetsRelease';

export function DropSetsAnnouncement({client,userId,ready}:{client:SupabaseClient;userId:string;ready:boolean}){
  return dropSetsRelease.eligible(ready,userId,location.pathname)
    ?<AccountDropSetsAnnouncement key={userId} client={client} userId={userId}/>:null;
}

function AccountDropSetsAnnouncement({client,userId}:{client:SupabaseClient;userId:string}){
  const [requested,setRequested]=useState(false),[open,setOpen]=useState(false),[attempt,setAttempt]=useState(0);
  const dismissed=useRef(false);
  useEffect(()=>{
    let active=true;
    const off=dropSetsRelease.subscribeDismissal(userId,()=>{
      dismissed.current=true;
      if(active){setOpen(false);setRequested(false);}
    });
    void dropSetsRelease.shouldShow(client,userId,true,location.pathname)
      .then(show=>{if(active&&show&&!dismissed.current)setRequested(true);}).catch(()=>{});
    const retry=watchConnectionRecovery(()=>setAttempt(value=>value+1));
    // A pending local dismissal never reopens; retry synchronization while this account is ready.
    const timer=setInterval(()=>{
      if(document.visibilityState==='visible'&&navigator.onLine&&dropSetsRelease.localAcknowledgement(userId)==='pending')
        void dropSetsRelease.reconcile(client,userId).catch(()=>{});
    },30_000);
    return()=>{active=false;off();retry();clearInterval(timer);};
  },[client,userId,attempt]);
  useEffect(()=>{
    if(!requested)return;
    let active=true,presented=false;
    const show=()=>{
      if(active&&!dismissed.current&&!presented&&!document.querySelector('[role="dialog"],[role="alertdialog"]')){
        presented=true;setOpen(true);
      }
    };
    const observer=new MutationObserver(show);
    observer.observe(document.body,{childList:true,subtree:true});show();
    return()=>{active=false;observer.disconnect();};
  },[requested]);
  // An explicit What's New action may review the current release; automatic display stays one-time.
  useEffect(()=>{
    const review=()=>{dismissed.current=false;setRequested(true);};
    window.addEventListener('open-release-announcement',review);
    return()=>window.removeEventListener('open-release-announcement',review);
  },[]);
  const dismiss=()=>{
    dismissed.current=true;
    dropSetsRelease.dismissLocally(userId);
    setOpen(false);setRequested(false);
    if(dropSetsRelease.localAcknowledgement(userId)==='pending')void dropSetsRelease.reconcile(client,userId).catch(()=>{});
  };
  return <div className="drop-release"><ConfirmDialog open={open} title="Progressive Overload 2.4"
    description="Track a complete drop-set sequence without inflating your workout totals."
    confirmLabel="Got It — Let’s Lift" singleAction destructive={false} onCancel={dismiss} onConfirm={dismiss}
    icon={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h18M6 12h15M9 19h12"/><path d="m3 10 2 2-2 2m3 3 2 2-2 2"/></svg>}>
    <DropSetsReleaseContent/>
  </ConfirmDialog></div>;
}

export function DropSetsReleaseContent(){
  return <>
    <h3 className="drop-release-headline">Drop Sets Have Arrived</h3>
    <div className="drop-release-example" role="img" aria-label="Example: one Main Set and two Drop Sets count as one set">
      <div><strong>Main Set</strong><span>100 lb × 8</span></div>
      <div><strong>Drop Set 1</strong><span>80 lb × 10</span></div>
      <div><strong>Drop Set 2</strong><span>60 lb × 12</span></div>
      <p>One complete sequence. <strong>One set.</strong></p>
    </div>
    <ul className="drop-release-highlights">
      <li>Tap <strong>Add Drop Set</strong> beside a supported Strength set.</li>
      <li>Your original lift becomes the <strong>Main Set</strong>.</li>
      <li>Add, duplicate, or remove one or more lighter follow-up <strong>Drop Sets</strong>.</li>
      <li>Saved in <strong>History</strong> and included in performance and <strong>PR analysis</strong>.</li>
      <li>The entire group counts as <strong>one set</strong> in totals and muscle-group statistics.</li>
    </ul>
  </>;
}
