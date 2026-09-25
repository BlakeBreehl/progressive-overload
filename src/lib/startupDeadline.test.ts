import {afterEach,expect,it,vi} from 'vitest';
import {startupDeadline} from './startupDeadline';
import {startAuth,type StartupState} from './startupAuth';
import {loadUserSetupWithRetry} from './settings';
afterEach(()=>vi.useRealTimers());
it('bounds a stalled request and ignores its late completion',async()=>{
 vi.useFakeTimers();let resolve!:(value:string)=>void;
 const request=startupDeadline(new Promise<string>(r=>{resolve=r;}),100);
 const assertion=expect(request).rejects.toMatchObject({status:408});
 await vi.advanceTimersByTimeAsync(100);await assertion;resolve('late');expect(vi.getTimerCount()).toBe(0);
});
it('clears the deadline when a request finishes',async()=>{vi.useFakeTimers();expect(await startupDeadline(Promise.resolve('ready'))).toBe('ready');expect(vi.getTimerCount()).toBe(0);});
it('retries stalled session restoration only three times, then offers a recoverable failure',async()=>{
 vi.useFakeTimers();const states:StartupState[]=[],getSession=vi.fn(()=>new Promise(()=>{}));
 const client={auth:{getSession,onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}};
 const stop=startAuth(client as never,state=>states.push(state),{timeoutMs:100});
 await vi.advanceTimersByTimeAsync(1100);
 expect(getSession).toHaveBeenCalledTimes(3);expect(states.at(-1)).toMatchObject({session:null,retryable:true});expect(states.at(-1)?.error).toContain('connection');stop();expect(vi.getTimerCount()).toBe(0);
});
it('bounds stalled companion reads and releases the shared request for Retry',async()=>{
 vi.useFakeTimers();const from=vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(()=>{})})})}));
 const client={from} as never;
 const request=loadUserSetupWithRetry(client,'a');const assertion=expect(request).rejects.toMatchObject({status:408});
 await vi.advanceTimersByTimeAsync(62000);await assertion;expect(from).toHaveBeenCalledTimes(8);
 const retry=loadUserSetupWithRetry(client,'a',{attempts:1});const next=expect(retry).rejects.toMatchObject({status:408});await vi.advanceTimersByTimeAsync(15000);await next;expect(from).toHaveBeenCalledTimes(10);
});
