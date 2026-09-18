import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {copyGroupCode,displayGroupCode,invalidGroupCode,normalizeGroupCode,shareGroupCode} from './groupCode';
import {joinGroup,groupError,createGroup,getGroupCode,replaceGroupCode} from './repository';
import frontend from './GroupsFeature.tsx?raw';
const code='ABCD2FGH';
it('uses exactly eight unambiguous characters and accepts case, separators and surrounding spaces',()=>{
 expect(displayGroupCode(code)).toBe('ABCD-2FGH');
 for(const input of [code,'abcd-2fgh',' ABCD - 2FGH \n'])expect(normalizeGroupCode(input)).toBe(code);
 for(const input of ['123e4567-e89b-12d3-a456-426614174000','a'.repeat(64),'ABCD0FGH','ABCDIFGH','ABCDOFGH','short'])expect(()=>displayGroupCode(input)).toThrow();
});
it('copies the short displayed code with an accessible manual fallback',async()=>{
 const writeText=vi.fn().mockResolvedValue(undefined);expect(await copyGroupCode(code,{clipboard:{writeText}})).toBe('Code copied.');expect(writeText).toHaveBeenCalledWith('ABCD-2FGH');expect(await copyGroupCode(code,{})).toBe('Select the Group Code and copy it.');
});
it('shares text only, falls back to copy and respects cancellation',async()=>{
 const share=vi.fn().mockResolvedValue(undefined),writeText=vi.fn().mockResolvedValue(undefined);
 expect(await shareGroupCode('Friends',code,{share,clipboard:{writeText}})).toBe('Code shared.');expect(share.mock.calls[0][0]).toEqual({title:'Friends',text:'Join Friends in Progressive Overload. Group Code: ABCD-2FGH'});
 expect(await shareGroupCode('Friends',code,{clipboard:{writeText}})).toBe('Code copied.');share.mockRejectedValue(new Error('Unavailable'));expect(await shareGroupCode('Friends',code,{share,clipboard:{writeText}})).toBe('Code copied.');share.mockRejectedValue({name:'AbortError'});expect(await shareGroupCode('Friends',code,{share})).toBe('Sharing canceled.');
});
it('creates a group and code with one atomic RPC and a stable retry identifier',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,group_id:'group',code},error:null}),client={rpc} as unknown as SupabaseClient;
 const first=await createGroup(client,'Friends','Alex','request');expect(await createGroup(client,'Friends','Alex','request')).toEqual(first);expect(rpc).toHaveBeenCalledTimes(2);expect(rpc.mock.calls.every(([name,args])=>name==='create_private_group_with_code'&&args.p_request_id==='request')).toBe(true);
 rpc.mockResolvedValue({data:{ok:false},error:null});await expect(createGroup(client,'Friends','Alex','request')).rejects.toThrow('Please retry');
});
it('only uses authenticated RPCs for joining, owner retrieval and replacement',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,group_id:'joined'},error:null}),from=vi.fn(),client={rpc,from} as unknown as SupabaseClient;
 expect(await joinGroup(client,' abcd-2fgh ','Alex')).toBe('joined');expect(rpc).toHaveBeenLastCalledWith('join_private_group_code',{p_code:code,p_display_name:'Alex'});
 rpc.mockResolvedValue({data:code,error:null});expect(await getGroupCode(client,'group')).toBe(code);
 rpc.mockResolvedValue({data:{ok:true,code},error:null});expect(await replaceGroupCode(client,'group')).toBe(code);expect(from).not.toHaveBeenCalled();
});
it.each(['invalid','expired','replaced','revoked','rate limited'])('uses one generic failed acceptance result: %s',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:{ok:false},error:null});try{await joinGroup({rpc} as unknown as SupabaseClient,code,'Alex');throw Error('Expected rejection');}catch(error){expect(groupError(error)).toBe(invalidGroupCode);}
});
it('retains network/session recovery without leaking codes in errors',async()=>{
 for(const [error,message] of [[{code:'',message:'Failed to fetch'},'Check your connection'],[{code:'PGRST301',message:'JWT expired'},'Your session has expired']] as const){const rpc=vi.fn().mockResolvedValue({error,data:null});try{await joinGroup({rpc} as unknown as SupabaseClient,code,'Alex');throw Error('Expected rejection');}catch(value){expect(groupError(value)).toContain(message);}}
});
it('removes legacy workflows and leaves replacement within group management',()=>{
 expect(frontend).not.toMatch(/Generate Code|Generate \/ Rotate|Disable joining|setInvite|inviteCode|location.hash|#invite|expires in|seven days/);
 expect(frontend).toContain('Manage Group');expect(frontend).toContain('Replace Group Code');expect(frontend).toContain('Friends can enter this code in Progressive Overload to join.');expect(frontend).toContain('key={props.userId}');expect(frontend).toContain('onChange={event=>setCode(event.target.value)}');expect(frontend).toContain('autoComplete="one-time-code"');
});
