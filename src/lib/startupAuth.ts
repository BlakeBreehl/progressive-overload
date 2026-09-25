import {startupTrace} from './startupDiagnostic';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { dataLoadMessage, safeSupabaseDiagnostic, transientDataError } from './supabaseError';
import {startupDeadline} from './startupDeadline';
const authDiagnostic=(operation:string,error:unknown)=>{const value=error as {code?:string;status?:number};safeSupabaseDiagnostic('Startup',operation,{code:value?.code,status:value?.status});};
export const invalidSession=(error:unknown)=>['user_not_found','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes((error as {code?:string})?.code??'');
export type StartupState={session:Session|null;loading:boolean;error:string;retryable?:boolean};
/** Auth callbacks never await SDK operations: deferred validation runs outside the auth lock. */
export function startAuth(client:SupabaseClient,publish:(state:StartupState)=>void,{onRecovery=()=>{},defer=(job:()=>void)=>setTimeout(job,0),wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=15000}:{onRecovery?:()=>void;defer?:(job:()=>void)=>unknown;wait?:(ms:number)=>Promise<unknown>;timeoutMs?:number}={}){
  let active=true,generation=0,eventReceived=false,readyUser:string|undefined,pendingUser:string|undefined,latestSession:Session|null=null;
  const accept=(session:Session|null)=>{
    startupTrace('Auth','account identity transition','event');
    latestSession=session;
    if(session&&pendingUser===session.user.id)return;
    pendingUser=undefined;
    const version=++generation,current=()=>active&&version===generation;
    if(!session){startupTrace('Auth','clear account','cleared');readyUser=undefined;publish({session:null,loading:false,error:''});return;}
    if(readyUser===session.user.id){publish({session,loading:false,error:''});return;}
    pendingUser=session.user.id;
    publish({session:null,loading:true,error:''});
    defer(()=>{void(async()=>{
      for(let attempt=0;attempt<3&&current();attempt++){
        try{
          startupTrace('Auth','validate server user');
          const {data,error}=await startupDeadline(client.auth.getUser(),timeoutMs);
          if(!current())return;
          if(error)throw error;
          if(!data.user||data.user.id!==session.user.id)throw Object.assign(new Error('Session user no longer exists'),{code:'user_not_found'});
          startupTrace('Auth','validate server user','ready');pendingUser=undefined;readyUser=data.user.id;publish({session:latestSession,loading:false,error:''});return;
        }catch(error){
          if(!current())return;
          authDiagnostic('validate session user',error);
          if(invalidSession(error)){
            // Invalidate publication before clearing the SDK session.
            pendingUser=undefined;readyUser=undefined;
            try{await startupDeadline(client.auth.signOut({scope:'local'}),timeoutMs);}catch{
              if(current())publish({session:null,loading:true,error:'Could not clear the expired session. Retry.',retryable:true});return;
            }
            if(current()){readyUser=undefined;publish({session:null,loading:false,error:''});}return;
          }
          if(attempt<2&&transientDataError(error)){await wait(250*2**attempt);continue;}
          pendingUser=undefined;
          publish({session:null,loading:true,error:dataLoadMessage('Session verification',error),retryable:transientDataError(error)});return;
        }
      }
    })();});
  };
  startupTrace('Auth','register auth subscription');
  const {data}=client.auth.onAuthStateChange((_event,session)=>{if(!active)return;startupTrace('Auth',_event==='TOKEN_REFRESHED'?'token refresh':'auth event','event');eventReceived=true;if(_event==='PASSWORD_RECOVERY')onRecovery();accept(session);});
  startupTrace('Auth','initial getSession');
  void(async()=>{
    for(let attempt=0;attempt<3&&active&&!eventReceived;attempt++){
      try{
        const result=await startupDeadline(client.auth.getSession(),timeoutMs);
        if(!active||eventReceived){startupTrace('Auth','initial getSession','ignored');return;}
        if(result.error)throw result.error;
        startupTrace('Auth','initial getSession','ready');accept(result.data.session);return;
      }catch(error){
        if(!active||eventReceived)return;
        authDiagnostic('read local session',error);
        if(attempt<2&&transientDataError(error)){await wait(250*2**attempt);continue;}
        publish({session:null,loading:true,error:dataLoadMessage('Session restore',error),retryable:transientDataError(error)});return;
      }
    }
  })();
  return()=>{active=false;generation++;data.subscription.unsubscribe();};
}
