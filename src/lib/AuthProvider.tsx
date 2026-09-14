import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { startAuth, type StartupState } from './startupAuth'
import { supabase } from './supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state,setState]=useState<StartupState>({session:null,loading:Boolean(supabase),error:''});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{if(supabase)return startAuth(supabase,setState);},[attempt]);
  const {session,loading,error}=state;
  const value = useMemo(() => ({ session, loading, error, retry:()=>setAttempt(value=>value+1), signOut: async () => { await supabase?.auth.signOut() } }), [session, loading,error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
