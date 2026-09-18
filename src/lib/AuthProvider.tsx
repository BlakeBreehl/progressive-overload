import {watchConnectionRecovery} from "./connectionRecovery";
import {RecoveryScreen} from '../components/PasswordManagement'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { startAuth, type StartupState } from './startupAuth'
import { supabase,initialRecovery } from './supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state,setState]=useState<StartupState>({session:null,loading:Boolean(supabase),error:''});
  const [recovery,setRecovery]=useState(initialRecovery);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{if(supabase)return startAuth(supabase,setState,{onRecovery:()=>setRecovery({active:true,invalid:false})});},[attempt]);
  const {session,loading,error}=state;
  useEffect(()=>{if(!error||!state.retryable)return;return watchConnectionRecovery(()=>setAttempt(value=>value+1));},[error,state.retryable]);
  useEffect(()=>{if(recovery.active&&!loading){history.replaceState(history.state,"","/auth/reset-password");}},[recovery.active,loading]);
  const value = useMemo(() => ({ session, loading, error, retry:()=>setAttempt(value=>value+1), signOut: async () => { await supabase?.auth.signOut() } }), [session, loading,error])
  return <AuthContext.Provider value={value}>{recovery.active&&supabase?<RecoveryScreen key={session?.user.id??"recovery"} client={supabase} loading={loading} hasSession={!!session} invalid={recovery.invalid} email={session?.user.email} error={error} retry={()=>setAttempt(value=>value+1)}/>:children}</AuthContext.Provider>
}
