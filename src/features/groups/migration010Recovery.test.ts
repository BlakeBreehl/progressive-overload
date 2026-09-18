// Source validation only: never executes SQL, including against local databases.
import {expect,it} from 'vitest';
import sql from '../../../supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql?raw';
import diagnostic from '../../../docs/GROUPS_010_PARTIAL_STATE_DIAGNOSTIC.sql?raw';
import verification from '../../../docs/GROUPS_010_VERIFY.sql?raw';
it('has balanced SQL strings and dollar bodies and one explicit transaction',()=>{
 const tokens=sql.match(/--[^\n]*|'(?:[^']|'')*'|\$[a-z_]*\$/gi)??[];let dollar:string|null=null;
 for(const token of tokens){if(token.startsWith('--')||token.startsWith("'"))continue;if(dollar===null)dollar=token;else if(dollar===token)dollar=null;}
 expect(dollar).toBeNull();expect(sql.match(/^begin;$/gm)).toHaveLength(1);expect(sql.match(/^commit;$/gm)).toHaveLength(1);
});
it('reuses every prefix table and function and fails closed on conflicts',()=>{
 expect(sql).toContain('create schema if not exists group_security');expect(sql.match(/create table if not exists/g)).toHaveLength(5);expect(sql).not.toMatch(/create function /);for(const phrase of ['incompatible column','incompatible constraint','incompatible function','incompatible schema','unexpected index','incompatible policies','access exclusive mode'])expect(sql).toContain(phrase);
});
it('preserves secret and encrypted code values on a completed rerun',()=>{
 expect(sql).toContain('where not exists(select 1 from group_security.secrets)');expect(sql).toContain('exists without its original secrets');expect(sql).not.toMatch(/(?:update|delete from|truncate|drop table) group_security.secrets/i);
 const backfill=sql.slice(sql.indexOf('-- Backfill ONLY'),sql.indexOf('-- No browser role'));
 expect(backfill).toContain('where not exists(select 1 from group_security.codes code_row where code_row.group_id=group_row.id)');expect(backfill).toContain('and not exists(select 1 from group_security.codes code_row where code_row.code_hash=invite_row.code_hash)');expect(backfill).not.toMatch(/group_members|group_progress_privacy/);
});
it('uses the existing release ledger with auth.uid only and idempotent inserts',()=>{
 const f=sql.slice(sql.indexOf('create or replace function public.acknowledge_release'),sql.indexOf('-- Backfill ONLY'));
 expect(f).toContain('values(auth.uid(),p_release_id)');expect(f).toContain('on conflict(user_id,release_id) do nothing');expect(f).not.toContain('p_user');expect(f).toContain('from public,anon,authenticated');expect(f).toContain('to authenticated');
});
it.each([diagnostic,verification])('keeps diagnostic/verification read-only and exposes only aggregate data',text=>{
 const uncommented=text.replace(/--[^\n]*/g,'');expect(uncommented).not.toMatch(/\b(?:insert\s+into|update\s+public|delete\s+from|create\s+(?:table|function)|alter\s+table|drop\s+|truncate\s+)\b/i);expect(uncommented).not.toMatch(/select\s+\*|(?:select|where)\s+group_security\.decrypt_code\(/i);expect(text).toContain('safe_counts');expect(text).toContain('groups_without_exactly_one_code');expect(text).toContain('NOT VERIFIABLE');expect(text).toContain('definition_matches');
});
