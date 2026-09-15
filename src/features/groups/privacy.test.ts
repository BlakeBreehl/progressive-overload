import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getProgressSharing,saveProgressSharing,privacyEvent,subscribePrivacyChange} from './privacy';
import {cardioRanks,strengthRanks} from './logic';
import type {GroupSummary} from './repository';
import source from './GroupsFeature.tsx?raw';
it('excludes opted-out members rather than creating zero competitors and restores history on re-enable',()=>{
 const members=[{member_id:'a',display_name:'Alex',role:'owner' as const,is_self:true,sharing_progress:false},{member_id:'b',display_name:'Blake',role:'member' as const,is_self:false,sharing_progress:true}],data={members,sets:[{member_id:'a',muscle:'Chest',total:99}],prs:[{member_id:'a',weight_prs:8,rep_prs:7}],cardio:[{member_id:'a',activity:'Run',entries:1,duration_seconds:3600,distance_meters:1000,distance_entries:1}]} as GroupSummary;
 const before=structuredClone(data);for(const metric of ['sets','weight','reps','combined'] as const)expect(strengthRanks(data,metric).map(row=>row.member_id)).toEqual(['b']);for(const metric of ['duration','distance'] as const)expect(cardioRanks(data,metric).map(row=>row.member_id)).toEqual(['b']);expect(data).toEqual(before);
 const enabled={...data,members:members.map(member=>({...member,sharing_progress:true}))};expect(strengthRanks(enabled)[0].value).toBe(99);expect(cardioRanks(enabled,'duration')[0].value).toBe(3600);
});
it('loads the actual preference and sends only the boolean, never a user ID, to its server setter',async()=>{
 const target=new EventTarget();vi.stubGlobal('window',target);vi.stubGlobal('CustomEvent',class extends Event{detail:unknown;constructor(type:string,options:{detail:unknown}){super(type);this.detail=options.detail;}});vi.stubGlobal('BroadcastChannel',undefined);
 try{const changed=vi.fn();const stop=subscribePrivacyChange('account-a',changed);const rpc=vi.fn().mockResolvedValue({data:true,error:null}),client={rpc} as unknown as SupabaseClient;expect(await getProgressSharing(client)).toBe(true);
 rpc.mockResolvedValue({data:false,error:null});await saveProgressSharing(client,'account-a',false);expect(rpc).toHaveBeenLastCalledWith('set_group_progress_sharing',{p_enabled:false});expect(changed).toHaveBeenCalledTimes(1);await saveProgressSharing(client,'unrelated',false);expect(changed).toHaveBeenCalledTimes(1);stop();await saveProgressSharing(client,'account-a',false);expect(changed).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllGlobals();}
});
it('does not announce success or change cached privacy on failed saves',async()=>{
 const dispatchEvent=vi.fn();vi.stubGlobal('window',{dispatchEvent});try{const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'offline'}});await expect(saveProgressSharing({rpc} as unknown as SupabaseClient,'a',false)).rejects.toBeDefined();expect(dispatchEvent).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
});
it('invalidates every mounted group snapshot and keeps member management separate from competition',()=>{
 expect(privacyEvent).toBe('group-progress-privacy-changed');expect(source).toContain('subscribePrivacyChange(userId,()=>{setSnapshot(null);setRevision(value=>value+1);})');expect(source).toContain('member.sharing_progress!==false');expect(source).toContain('Progress hidden');expect(source).toContain('data.members.map(member=><li');expect(source).toContain('competitors.map(member=><p');expect(source).toContain('key={props.userId}');
});
