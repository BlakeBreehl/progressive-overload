import {describe,expect,it,vi} from 'vitest';
import type {Session} from '@supabase/supabase-js';
import {startAuth,type StartupState} from './startupAuth';
const session=(id:string)=>({user:{id}} as Session);
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
  let event!:(_event:string,value:Session|null)=>void;
  const initial=deferred<{data:{session:Session|null};error:null}>(),getUser=vi.fn(),signOut=vi.fn(async()=>({error:null})),unsubscribe=vi.fn(),jobs:Array<()=>void>=[],states:StartupState[]=[];
  const client={auth:{onAuthStateChange:vi.fn(callback=>{event=callback;return {data:{subscription:{unsubscribe}}};}),getSession:()=>initial.promise,getUser,signOut}};
  const stop=startAuth(client as never,state=>states.push(state),{defer:job=>jobs.push(job),wait:async()=>{}});
  return{event:(id:string|null)=>event('SIGNED_IN',id?session(id):null),initial,getUser,signOut,unsubscribe,jobs,states,stop};
}
describe('startup sequencing without refresh',()=>{
  it('validates outside the auth callback then renders without refresh',async()=>{
    const f=fixture();f.getUser.mockResolvedValue({data:{user:{id:'a'}},error:null});f.event('a');expect(f.getUser).not.toHaveBeenCalled();expect(f.states.at(-1)?.loading).toBe(true);f.jobs.shift()!();await flush();expect(f.states.at(-1)).toMatchObject({loading:false,session:{user:{id:'a'}}});
  });
  it('a stale getSession result cannot overwrite a newer auth event',async()=>{
    const f=fixture();f.getUser.mockResolvedValue({data:{user:{id:'new'}},error:null});f.event('new');f.jobs.shift()!();await flush();f.initial.resolve({data:{session:session('old')},error:null});await flush();expect(f.states.at(-1)?.session?.user.id).toBe('new');
  });
  it('prior-account validation cannot publish after an account switch',async()=>{
    const f=fixture(),old=deferred<unknown>();f.getUser.mockReturnValueOnce(old.promise).mockResolvedValueOnce({data:{user:{id:'b'}},error:null});f.event('a');f.jobs.shift()!();f.event('b');f.jobs.shift()!();await flush();old.resolve({data:{user:{id:'a'}},error:null});await flush();expect(f.states.at(-1)?.session?.user.id).toBe('b');
  });
  it('clears a deleted-user stale session locally',async()=>{
    const f=fixture();f.getUser.mockResolvedValue({data:{user:null},error:{code:'user_not_found',status:401}});f.event('deleted');f.jobs.shift()!();await flush();expect(f.signOut).toHaveBeenCalledWith({scope:'local'});expect(f.states.at(-1)).toEqual({session:null,loading:false,error:''});
  });
  it('bounded transient validation retry succeeds without refresh',async()=>{
    const f=fixture();f.getUser.mockResolvedValueOnce({error:{status:503}}).mockResolvedValueOnce({data:{user:{id:'a'}},error:null});f.event('a');f.jobs.shift()!();await flush();expect(f.getUser).toHaveBeenCalledTimes(2);expect(f.states.at(-1)?.loading).toBe(false);
  });
  it('Strict Mode disposal suppresses pending initialization',async()=>{
    const f=fixture();f.event('a');f.stop();const count=f.states.length;f.jobs.shift()!();f.initial.resolve({data:{session:session('a')},error:null});await flush();expect(f.states).toHaveLength(count);expect(f.unsubscribe).toHaveBeenCalledOnce();expect(f.getUser).not.toHaveBeenCalled();
  });
  it('token refresh does not unmount a ready account',async()=>{
    const f=fixture();f.getUser.mockResolvedValue({data:{user:{id:'a'}},error:null});f.event('a');f.jobs.shift()!();await flush();const count=f.states.length;f.event('a');expect(f.states.slice(count).every(state=>!state.loading)).toBe(true);
  });
});
