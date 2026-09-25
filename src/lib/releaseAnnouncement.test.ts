import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {acknowledgeRelease,releaseId,shouldAnnounce,subscribeReleaseDismissal} from './releaseAnnouncement';
import component from '../components/ReleaseAnnouncement.tsx?raw';
import source from './releaseAnnouncement.ts?raw';
let saved:Set<string>,account:string,failedLoad:boolean,failedSave:boolean;
const rpc=vi.fn(async(name:string,args:{p_release_id:string})=>{
 if(name==='get_release_acknowledgement')return {data:saved.has(account+args.p_release_id),error:failedLoad?{}:null};
 if(failedSave)return {error:{}};
 saved.add(account+args.p_release_id);return {error:null};
});
const client={rpc} as never;
beforeEach(()=>{saved=new Set();account='A';failedLoad=false;failedSave=false;rpc.mockClear();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('localStorage',{setItem:vi.fn()});});
afterEach(()=>vi.unstubAllGlobals());
it('uses the fixed release identity and waits for authenticated readiness',async()=>{
 expect(releaseId).toBe('progressive-overload-2.1-launch');expect(await shouldAnnounce(client,'A',false)).toBe(false);expect(await shouldAnnounce(client,'',true)).toBe(false);expect(rpc).not.toHaveBeenCalled();expect(await shouldAnnounce(client,'A',true)).toBe(true);
});
it.each(['refresh','cold start','route change','token refresh','component remount','PWA reopen','browser reopen','cleared local cache'])('honors the server after %s',async()=>{
 await acknowledgeRelease(client,'A');vi.stubGlobal('localStorage',{});expect(await shouldAnnounce(client,'A',true)).toBe(false);expect(rpc).toHaveBeenLastCalledWith('get_release_acknowledgement',{p_release_id:releaseId});
});
it('keeps A and B independent and remembers A on return',async()=>{
 await acknowledgeRelease(client,'A');account='B';expect(await shouldAnnounce(client,'B',true)).toBe(true);account='A';expect(await shouldAnnounce(client,'A',true)).toBe(false);
});
it('does not falsely mark a failed save and can retry',async()=>{
 failedSave=true;await expect(acknowledgeRelease(client,'A')).rejects.toThrow('retry');expect(localStorage.setItem).not.toHaveBeenCalled();expect(saved.size).toBe(0);failedSave=false;await acknowledgeRelease(client,'A');expect(await shouldAnnounce(client,'A',true)).toBe(false);
});
it('fails closed on load errors and retries against the server',async()=>{
 failedLoad=true;await expect(shouldAnnounce(client,'A',true)).rejects.toThrow('retry');failedLoad=false;expect(await shouldAnnounce(client,'A',true)).toBe(true);
});
it('waits for a slow load rather than interpreting pending as unseen',async()=>{
 let resolve!:(value:{data:boolean;error:null})=>void;const pending=shouldAnnounce({rpc:()=>new Promise(r=>{resolve=r;})} as never,'A',true);let finished=false;void pending.then(()=>{finished=true;});await Promise.resolve();expect(finished).toBe(false);resolve({data:true,error:null});expect(await pending).toBe(false);
});
it('notifies same-document consumers only after server acknowledgement',async()=>{
 const a=vi.fn(),b=vi.fn(),off=subscribeReleaseDismissal('A',a),offB=subscribeReleaseDismissal('B',b);await acknowledgeRelease(client,'A');expect(a).toHaveBeenCalledOnce();expect(b).not.toHaveBeenCalled();off();offB();
});
it('synchronizes other tabs by account and release and removes listeners',()=>{
 const dismiss=vi.fn(),off=subscribeReleaseDismissal('A',dismiss);const emit=(key:string,newValue:string|null)=>window.dispatchEvent(Object.assign(new Event('storage'),{key,newValue}));
 emit(releaseId+':B','dismissed');emit(releaseId+':A',null);expect(dismiss).not.toHaveBeenCalled();emit(releaseId+':A','dismissed');expect(dismiss).toHaveBeenCalledOnce();off();emit(releaseId+':A','dismissed');expect(dismiss).toHaveBeenCalledOnce();
});
it('has no session persistence, runtime identity, native dialogs or production reset',()=>{
 expect(source+component).not.toMatch(/sessionStorage|Date.now|Math.random|window\.(alert|confirm|prompt)|import.meta.env|resetAnnouncement|removeItem/);
 expect(component).toContain('ready&&loaded&&open');expect(component).toContain('props.ready&&props.userId');expect(component).toContain('key={props.userId}');expect(component).toContain('Retry dismissal');expect(component).toContain('if(show&&!dismissed)');
});

it('never resets or writes the original 2.0 acknowledgement',async()=>{const original='Aprogressive-overload-2.0-launch';saved.add(original);expect(await shouldAnnounce(client,'A',true)).toBe(true);await acknowledgeRelease(client,'A');expect(saved.has(original)).toBe(true);expect(saved.size).toBe(2);expect(rpc.mock.calls.every(([,args])=>args.p_release_id===releaseId)).toBe(true);});
