import {ConfirmationScreen} from '../components/ConfirmationScreen';
import {callbackSnapshot} from './emailConfirmation';
import {watchConnectionRecovery} from "./connectionRecovery";
import {RecoveryScreen} from '../components/PasswordManagement'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { startAuth, type StartupState } from './startupAuth'
import { supabase,initialRecovery } from './supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state,setState]=useState<StartupState>({session:null,loading:Boolean(supabase),error:''});
  const [recovery,setRecovery]=useState(initialRecovery);
  const [attempt,setAttempt]=useState(0);
  const [callbackPending,setCallbackPending]=useState(Boolean(callbackSnapshot?.active));
  const finishCallback=useCallback(()=>{setState({session:null,loading:true,error:""});setCallbackPending(false);setAttempt(value=>value+1);},[]);
  useEffect(()=>{if(!supabase)return;if(callbackPending){const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setRecovery({active:true,invalid:false});});return()=>data.subscription.unsubscribe();}return startAuth(supabase,setState,{onRecovery:()=>setRecovery({active:true,invalid:false})});},[attempt,callbackPending]);
  const {session,loading,error}=state;
  useEffect(()=>{if(!error||!state.retryable)return;return watchConnectionRecovery(()=>setAttempt(value=>value+1));},[error,state.retryable]);
  useEffect(()=>{if(recovery.active&&!loading){history.replaceState(history.state,"","/auth/reset-password");}},[recovery.active,loading]);
  const value = useMemo(() => ({ session, loading, error, retry:()=>setAttempt(value=>value+1), signOut: async () => { await supabase?.auth.signOut() } }), [session, loading,error])
  return <AuthContext.Provider value={value}>{callbackPending&&callbackSnapshot&&supabase?<ConfirmationScreen client={supabase} callback={callbackSnapshot} onDone={finishCallback}/>:recovery.active&&supabase?<RecoveryScreen key={session?.user.id??"recovery"} client={supabase} loading={loading} hasSession={!!session} invalid={recovery.invalid} email={session?.user.email} error={error} retry={()=>setAttempt(value=>value+1)}/>:children}</AuthContext.Provider>
}
