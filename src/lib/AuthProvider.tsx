import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  useEffect(() => {
    if (!supabase) return
    let active = true
    let authEventReceived = false
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if(!active)return;authEventReceived=true;setSession(next);setLoading(false) })
    supabase.auth.getSession().then(({ data:result,error }) => { if (active&&!authEventReceived) { setSession(error?null:result.session); setLoading(false) } }).catch(()=>{if(active&&!authEventReceived)setLoading(false)})
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  const value = useMemo(() => ({ session, loading, signOut: async () => { await supabase?.auth.signOut() } }), [session, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
