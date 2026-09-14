import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfirmDialog } from './ConfirmDialog';
import { acknowledgeRelease, markShown, shouldAnnounce } from '../lib/releaseAnnouncement';
export function ReleaseAnnouncement({client,userId,ready}:{client:SupabaseClient;userId:string;ready:boolean}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{let active=true;shouldAnnounce(client,userId,ready).then(show=>{if(active&&show){markShown(userId);setOpen(true);}}).catch(()=>{/* A failed announcement must not block the app. */});return()=>{active=false;};},[client,userId,ready]);
  const close=()=>{setOpen(false);void acknowledgeRelease(client,userId);};
  return <ConfirmDialog open={ready&&open} title="Progressive Overload 2.0" description="More reliable tracking. A clearer view of your progress." confirmLabel="Let's Go" cancelLabel="Close" destructive={false} onCancel={close} onConfirm={close}>
    <svg className="mb-3 text-red" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>
    <ul className="list-disc space-y-2 pl-4 text-sm"><li>More reliable workout and Bodyweight tracking</li><li>Corrected historical Weight and Rep PRs</li><li>Four Strength Progress graph modes</li><li>Searchable, paginated histories</li><li>Clearer Bodyweight trends and comparisons</li><li>Faster inline location creation</li><li>Better mobile navigation and layout</li><li>Monthly muscle-group set breakdown</li></ul>
  </ConfirmDialog>;
}
