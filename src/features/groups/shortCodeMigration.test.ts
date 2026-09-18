// Read-only migration contracts: this suite does not execute SQL or prove live RLS.
import {expect,it} from 'vitest';
import sql from '../../../supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql?raw';
const fn=(name:string)=>sql.slice(sql.indexOf(`function ${name}(`)).split('end $$;')[0];
it('is one forward-only transaction and retires invitation state without rewriting personal records',()=>{
 expect(sql.match(/^begin;$/gm)).toHaveLength(1);expect(sql.match(/^commit;$/gm)).toHaveLength(1);
 expect(sql).not.toMatch(/(?:update|delete from|alter table) public\.(profiles|user_settings|strength_sets|strength_workouts|cardio_sessions|weigh_ins|mobility_sets)/);
 const backfill=sql.slice(sql.indexOf('-- Backfill ONLY'),sql.indexOf('-- No browser role'));
 expect(backfill).toContain('update public.group_invites');expect(backfill).toContain('select group_row.id from public.groups');expect(backfill).toContain('group_security.issue_code(v_group_row.id)');expect(backfill).not.toMatch(/insert into public.group_members|delete from public.group_members/);
});
it('generates eight unbiased crypto characters and retries unique collisions without truncating hashes',()=>{
 const issue=fn('group_security.issue_code');expect(issue).toContain("'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'");expect(new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789').size).toBe(32);
 expect(issue).toContain('v_retry integer');expect(issue).toContain('v_byte_index integer');
 expect(issue).toContain('group_security.random_bytes(8)');expect(issue).toContain('for v_byte_index in 0..7');expect(issue).toContain('(get_byte(v_bytes,v_byte_index)&31)+1');expect(issue).toContain('for v_retry in 1..32');expect(issue).toContain('exception when unique_violation then continue');
 expect(issue).not.toMatch(/random\(|gen_random_uuid|substr\(digest|left\(digest/);expect(sql).toContain('code_hash text not null unique');expect(sql).toContain('gen_random_bytes($1)');
});
it('uses keyed hashes and owner-only encrypted retrieval without granting secret/helper access',()=>{
 expect(sql).toContain("hmac(convert_to($1,''UTF8''),$2,''sha256'')");expect(sql).toContain('pgp_sym_encrypt');expect(sql).toContain('cipher-algo=aes256');expect(sql).toContain('hash_key bytea not null, encryption_key text not null');
 expect(fn('public.get_private_group_code')).toContain('owner_user_id=auth.uid()');expect(sql).toContain('revoke all on all tables in schema group_security from public,anon,authenticated');expect(sql).toContain('revoke all on all functions in schema group_security from public,anon,authenticated');
 expect(sql).not.toMatch(/grant (?:select|all).*group_security/);expect(sql).not.toMatch(/raise (?:notice|log|warning)/i);
});
it('creates group and code atomically and serializes retry keys by authenticated account',()=>{
 const create=fn('public.create_private_group_with_code');expect(create).toContain('v_user uuid:=auth.uid()');expect(create).toContain('where request_row.user_id=v_user and request_row.request_id=p_request_id for update');expect(create).toContain('if v_group is not null then return');expect(create).toContain('public.create_private_group(p_name,p_display_name)');expect(create).toContain('group_security.issue_code(v_group)');expect(create).not.toContain('exception when');
 expect(sql).toContain('primary key(user_id,request_id)');expect(sql).toContain('public.join_private_group(text,text) from public,anon,authenticated');
});
it('persists failed-guess limits by returning generic failures instead of rolling them back',()=>{
 const join=fn('public.join_private_group_code');expect(join).toContain("'join-quarter-hour',v_user::text,20,900");expect(join).toContain("'join-day',v_user::text,100,86400");expect(join).toContain("'join-global-hour','all',5000,3600");
 const counted=join.slice(join.indexOf("if not group_security.take_attempt"));expect(counted).not.toMatch(/raise exception/i);expect(counted).toContain("jsonb_build_object('ok',false)");expect(counted).toContain("upper(regexp_replace(p_code,'[[:space:]-]','','g'))");expect(counted).toContain("'^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'");
 const limiter=fn('group_security.take_attempt');expect(limiter).toContain('on conflict(scope,subject) do update');expect(limiter).toContain('p_limit+1');
});
it('retains membership and owner checks, locking and old-code invalidation',()=>{
 const join=fn('public.join_private_group_code');expect(join).toContain('where group_row.id=v_group for update');expect(join).toContain('where invite_row.code_hash=v_digest for update');expect(join).toContain('if not exists(select 1 from public.group_members');expect(join).toContain("values(v_group,v_user,'member',trim(p_display_name))");expect(join).toContain('v_invitation_row.revoked_at is not null');
 expect(fn('public.replace_private_group_code')).toContain('owner_user_id=auth.uid()');expect(fn('group_security.issue_code')).toContain('invite_row.code_hash<>v_digest and invite_row.revoked_at is null');
 const manage=fn('public.manage_private_group');expect(manage).toContain('v_group_row.owner_user_id<>v_user');expect(manage).toContain('Cannot remove the group owner');expect(manage).not.toContain("p_action in ('invite','revoke')");
});
it('defaults sharing to enabled with self-only RPCs and no workout or membership mutation',()=>{
 expect(sql).toContain('share_progress boolean not null default true');expect(sql).toContain('where privacy_row.user_id=p_user),true)');expect(sql).toContain('alter table public.group_progress_privacy enable row level security');
 const save=fn('public.set_group_progress_sharing');expect(save).toContain('values(auth.uid(),p_enabled)');expect(save).not.toMatch(/p_user|group_members|workouts|weigh_ins/);expect(sql).toContain('revoke all on public.group_progress_privacy from public, anon, authenticated');
});
it('filters every aggregate and activity list through one privacy-eligible member population',()=>{
 const summary=fn('public.private_group_summary');expect(summary).toContain('left join public.group_progress_privacy privacy_row on privacy_row.user_id=member_row.user_id');expect(summary).toContain('coalesce(privacy_row.share_progress,true)');
 expect(summary.match(/and member_row.user_id=any\(v_eligible\) and/g)).toHaveLength(4);
 expect(summary).toContain("'sharing_progress',member_row.user_id=any(v_eligible)");expect(summary).toContain('not public.is_group_member(p_group_id)');expect(summary).not.toMatch(/p_user|weigh_ins|\.notes|\.email|locations/);
 for(const part of ['with counted as','with source as','with entries as','select distinct lower'])expect(summary.slice(summary.indexOf(part)).split(';')[0]).toContain('member_row.user_id=any(v_eligible)');
});
it('uses protected search paths and only grants reviewed public RPC entry points to authenticated',()=>{
 const declarations=[...sql.matchAll(/create (?:or replace )?function [\s\S]*?as \$\$/g)].map(match=>match[0]);expect(declarations.length).toBeGreaterThan(8);for(const declaration of declarations)expect(declaration).toContain("security definer set search_path=''");
 expect(sql).toContain('to authenticated;');expect(sql).not.toMatch(/grant execute[^;]*to (?:public|anon);/);
});
