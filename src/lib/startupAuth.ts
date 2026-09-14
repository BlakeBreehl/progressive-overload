import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { safeSupabaseDiagnostic } from './supabaseError';
export const invalidSession=(error:unknown)=>['user_not_found','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes((error as {code?:string})?.code??'');
export type StartupState={session:Session|null;loading:boolean;error:string};
/** Auth callbacks never await SDK operations: deferred validation runs outside the auth lock. */
export function startAuth(client:SupabaseClient,publish:(state:StartupState)=>void,{defer=(job:()=>void)=>setTimeout(job,0),wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))}:{defer?:(job:()=>void)=>unknown;wait?:(ms:number)=>Promise<unknown>}={}){
  let active=true,generation=0,eventReceived=false,readyUser:string|undefined;
  const accept=(session:Session|null)=>{
    const version=++generation,current=()=>active&&version===generation;
    if(!session){readyUser=undefined;publish({session:null,loading:false,error:''});return;}
    if(readyUser===session.user.id){publish({session,loading:false,error:''});return;}
    publish({session:null,loading:true,error:''});
    defer(()=>{void(async()=>{
      for(let attempt=0;attempt<3&&current();attempt++){
        try{
          const {data,error}=await client.auth.getUser();
          if(!current())return;
          if(error)throw error;
          if(!data.user||data.user.id!==session.user.id)throw Object.assign(new Error('Session user no longer exists'),{code:'user_not_found'});
          readyUser=data.user.id;publish({session,loading:false,error:''});return;
        }catch(error){
          if(!current())return;
          safeSupabaseDiagnostic('Startup','validate session user',error);
          if(invalidSession(error)){
            await client.auth.signOut({scope:'local'});
            if(current()){readyUser=undefined;publish({session:null,loading:false,error:''});}return;
          }
          const status=(error as {status?:number})?.status;
          if(attempt<2&&(status===undefined||status>=500)){await wait(250*2**attempt);continue;}
          publish({session:null,loading:true,error:'Could not verify your session. Check your connection and retry.'});return;
        }
      }
    })();});
  };
  const {data}=client.auth.onAuthStateChange((_event,session)=>{if(!active)return;eventReceived=true;accept(session);});
  client.auth.getSession().then(result=>{if(!active||eventReceived)return;if(result.error){safeSupabaseDiagnostic('Startup','read local session',result.error);publish({session:null,loading:true,error:'Could not restore your session. Retry.'});}else accept(result.data.session);}).catch(error=>{if(active&&!eventReceived){safeSupabaseDiagnostic('Startup','read local session',error);publish({session:null,loading:true,error:'Could not restore your session. Retry.'});}});
  return()=>{active=false;generation++;data.subscription.unsubscribe();};
}
