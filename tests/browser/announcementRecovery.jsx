// Real React/browser lifecycle, mock account-scoped database. No live credentials or SQL.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ReleaseAnnouncement} from '../../src/components/ReleaseAnnouncement';
import {releaseId} from '../../src/lib/releaseAnnouncement';
import '../../src/index.css';
const peer=new URLSearchParams(location.search).has('peer');
const server=peer?parent.__releaseServer:(window.__releaseServer={saved:new Set()});
let account='A',loadFailure=false,saveFailure=false,loadGate=null,navigated=0;
const calls=[],checks=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,name)=>checks.push({name,pass:Boolean(condition)});
const client={rpc:async(name,args)=>{
 calls.push({name,args});const user=account;
 if(name==='get_release_acknowledgement'){
  const result={data:server.saved.has(user+args.p_release_id),error:loadFailure?{}:null};
  if(loadGate)await loadGate;
  return result;
 }
 if(saveFailure)return {error:{}};
 server.saved.add(user+args.p_release_id);return {error:null};
}};
const root=createRoot(document.getElementById('root'));
const render=(user=account,ready=true,key=user)=>{account=user;root.render(<ReleaseAnnouncement key={key} client={client} userId={user} ready={ready} onLeaderboards={()=>{navigated++;}}/>);};
const modal=()=>document.querySelector('[role=alertdialog]');
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const absent=()=>!modal();
if(peer){render();window.peerReady=true;}
else void (async()=>{
 let nativeDialogs=0;for(const name of ['alert','confirm','prompt'])window[name]=()=>{nativeDialogs++;};
 render('A',false);await wait(80);assert(absent()&&calls.length===0,'waits for authenticated bootstrap');
 let release;loadGate=new Promise(resolve=>{release=resolve;});render();await wait(80);assert(absent(),'slow state load does not flash');release();loadGate=null;await wait(80);assert(Boolean(modal()),'first eligible account sees announcement');
 saveFailure=true;button('Close').click();await wait(60);assert(Boolean(modal())&&!server.saved.size&&Boolean(document.querySelector('[role=alert]')),'failed save stays open with retry and does not complete');
 saveFailure=false;button('Retry dismissal').click();await wait(60);assert(absent()&&server.saved.has('A'+releaseId),'retry saves before closing');
 for(const scenario of ['route change','token refresh']){render();await wait(40);assert(absent(),scenario+' does not reopen');}
 for(const scenario of ['component remount','cold start','PWA/browser reopen']){root.render(null);await wait(30);render('A',true,scenario);await wait(60);assert(absent(),scenario+' reads durable server result');}
 localStorage.clear();root.render(null);await wait(20);render();await wait(60);assert(absent(),'clearing local cache still honors server dismissal');
 render('B');await wait(60);assert(Boolean(modal()),'B has independent unseen state');
 render('A');await wait(60);assert(absent(),'switching back to A stays dismissed');
 render('A',false);await wait(30);assert(absent(),'sign-out unmounts in-memory state');render();await wait(60);assert(absent(),'sign-in restores server dismissal');
 account='C';loadFailure=true;render('C');await wait(60);assert(absent()&&Boolean(button('Retry')),'load failure is safe and retryable');loadFailure=false;button('Retry').click();await wait(60);assert(Boolean(modal()),'load retry resumes eligibility');
 button('View Leaderboards').click();await wait(60);assert(absent()&&navigated===1&&server.saved.has('C'+releaseId),'completion saves before navigating');
 window.dispatchEvent(new Event('open-release-announcement'));await wait(60);assert(Boolean(modal()),'intentional What?s New remains available');button('Close').click();await wait(60);
 // A separate same-origin document receives a genuine browser storage event.
 server.saved.delete('A'+releaseId);localStorage.removeItem(releaseId+':A');render('A');await wait(60);
 const frame=document.createElement('iframe');frame.src='/__announcement-recovery?peer=1';document.body.append(frame);
 for(let i=0;i<100&&!frame.contentWindow?.peerReady;i++)await wait(30);
 await wait(100);assert(Boolean(frame.contentDocument.querySelector('[role=alertdialog]')),'second document initially sees unseen A');
 button('Close').click();await wait(100);assert(absent()&&!frame.contentDocument.querySelector('[role=alertdialog]'),'browser storage event dismisses both documents');frame.remove();
 // A stale initial response must not resurrect a concurrently acknowledged release.
 let resolveLate;loadGate=new Promise(resolve=>{resolveLate=resolve;});render('D');await wait(50);
 window.dispatchEvent(Object.assign(new Event('storage'),{key:releaseId+':D',newValue:'dismissed'}));resolveLate();loadGate=null;await wait(60);assert(absent(),'cross-tab dismissal wins over stale initial lookup');
 assert(nativeDialogs===0,'no native alert confirm prompt');assert(calls.every(call=>Object.keys(call.args).join(',')==='p_release_id'),'client never submits an account ID');
 root.unmount();document.getElementById('result').textContent=JSON.stringify({checks,failures:checks.filter(c=>!c.pass)});
})().catch(error=>{document.getElementById('result').textContent=JSON.stringify({error:String(error),checks});});
