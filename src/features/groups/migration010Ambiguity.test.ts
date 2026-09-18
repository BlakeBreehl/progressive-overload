// Static contracts only. Never connects to a PostgreSQL server or executes SQL.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import sql from '../../../supabase/migrations/202609150010_short_group_codes_and_progress_privacy.sql?raw';
import release008 from '../../../supabase/migrations/202609140008_release_announcements.sql?raw';
const executable=(text:string)=>text.replace(/--[^\n]*|'(?:[^']|'')*'/g,' ');
const bodies=[...sql.matchAll(/(\$(?:[a-z_]+)?\$)([\s\S]*?)\1/g)].map(match=>match[2]);
function names(body:string){
 const text=executable(body),declarations=text.match(/\bdeclare\b([\s\S]*?)\bbegin\b/i)?.[1]??'';
 const locals=declarations.split(';').map(part=>part.trim().match(/^(\w+)\s+/)?.[1]).filter((name):name is string=>Boolean(name));
 const reserved=new Set(['where','set','values','on','returning','for','order','group']);
 const aliases=[...text.matchAll(/\b(?:from|join|update|into)\s+(?:pg_catalog|public|auth|group_security)\.\w+\s+(?:as\s+)?(\w+)/g)].map(match=>match[1]).filter(name=>!reserved.has(name));
 aliases.push(...[...text.matchAll(/\)\s+(\w+)\s*\(/g)].map(match=>match[1]).filter(name=>!['values','in','exists','filter','over'].includes(name)));
 return {locals,aliases};
}
it('detects the reported record/table-alias collision in a regression fixture',()=>{
 const {locals,aliases}=names('declare r record; p record; begin select p.oid into r from pg_catalog.pg_proc p where p.pronamespace=1; end');
 expect(locals.filter(name=>aliases.includes(name))).toEqual(['p']);
});
it('keeps PL/pgSQL locals disjoint from SQL aliases in every dollar body',()=>{
 expect(bodies.length).toBeGreaterThan(15);
 for(const body of bodies){const {locals,aliases}=names(body);expect(locals.filter(name=>aliases.includes(name))).toEqual([]);for(const local of locals)expect(local).toMatch(/^v_/);for(const alias of aliases)expect(alias).not.toMatch(/^v_/);}
 expect(executable(sql)).not.toMatch(/\bdeclare\s+p\s+record/i);
});
it('uses record suffixes for all record and table-row locals',()=>{
 for(const body of bodies){const declarations=executable(body).match(/\bdeclare\b([\s\S]*?)\bbegin\b/i)?.[1]??'';for(const match of declarations.matchAll(/\b(\w+)\s+(?:record|(?:public|group_security)\.\w+)\b/g))expect(match[1]).toMatch(/^v_\w+_(?:row|record)$/);}
});
it('qualifies function catalog reads and distinguishes proc_row from v_proc_row',()=>{
 const block=sql.split('do $function_compatibility$')[1].split('end $function_compatibility$;')[0];
 expect(block).toContain('select proc_row.* into v_proc_row from pg_catalog.pg_proc proc_row where proc_row.oid=pg_catalog.to_regprocedure(v_expected_row.signature)');
 for(const column of ['proowner','prorettype','prokind','proretset'])expect(block).toContain('v_proc_row.'+column);
 for(const column of ['pronamespace','proname','oid'])expect(block).toContain('proc_row.'+column);
 expect(block).toContain('namespace_row.oid=proc_row.pronamespace');expect(block).toContain('role_row.rolname=current_user');expect(block).not.toMatch(/\bp\./);
 for(const token of executable(sql).matchAll(/(?<![.\w])(?:pronamespace|proname|proowner|prorettype|prokind|proretset|conrelid|conname|nspname|nspowner|rolname|indrelid|indisvalid|indisready)\b/g))expect.fail('Unqualified catalog column: '+token[0]);
});
it('qualifies account/group reads and limiter RETURNING without changing conflict keys',()=>{
 expect(sql).toContain('returning attempt_row.attempts into v_attempt_count');expect(sql).toContain('on conflict(scope,subject) do update');expect(sql).toContain('on conflict(user_id,release_id) do nothing');
 expect(sql).toContain('where release_row.user_id=auth.uid() and release_row.release_id=p_release_id');
 expect(executable(sql)).not.toMatch(/\b(?:where|and)\s+(?:id|name|scope|subject|group_id|user_id|code_hash|attempts|release_id|seen_at)\s*(?:=|<>|is\b)/i);
});
it('keeps compatibility checks before data writes in one transaction',()=>{
 expect(sql.match(/^begin;$/gm)).toHaveLength(1);expect(sql.match(/^commit;$/gm)).toHaveLength(1);
 const checkEnd=sql.indexOf('end $function_compatibility$;');expect(checkEnd).toBeLessThan(sql.indexOf('insert into group_security.secrets('));expect(checkEnd).toBeLessThan(sql.indexOf('-- Backfill ONLY'));
 expect(sql).toContain('where not exists(select 1 from group_security.secrets)');expect(sql).not.toMatch(/(?:update|delete from|truncate|drop table) group_security.secrets/i);
 expect(sql).toContain('where not exists(select 1 from group_security.codes code_row where code_row.group_id=group_row.id)');expect(sql).toContain('where code_row.code_hash=invite_row.code_hash');
});
it('retains migration 008 compatibility and both self-scoped announcement RPCs',()=>{
 expect(sql).toContain('Migration 010 requires migration 008: public.release_announcements');expect(sql).toContain("v_expected_row.table_name<>'public.release_announcements' and exists");
 expect(release008).toContain('grant select, insert on public.release_announcements to authenticated');expect(release008).toContain('for select to authenticated');expect(release008).toContain('for insert to authenticated');
 expect(sql).toContain('create or replace function public.get_release_acknowledgement(p_release_id text) returns boolean');expect(sql).toContain('create or replace function public.acknowledge_release(p_release_id text) returns void');expect(sql).toContain('values(auth.uid(),p_release_id)');expect(sql).not.toContain('create table if not exists public.release_announcements');
});
// Exact byte hashes for the existing files; allow only Git's LF or CRLF checkout form.
const priorMigrationHashes:Record<string,string[]> = {
  "202608300001_progressive_overload_foundation.sql": [
    "69eee5b5544a9568bc959f0b2f13f5bed00de07ea0f5604f5993f27af95ce26c",
    "bf65d89fbabee08c1a113b59f44437654df3ffd884d784283726e4a1df249bee"
  ],
  "202608300002_strength_whole_reps.sql": [
    "5965aba0e3957fb7cf0fa4a140f51bf6117d6ee1aa1bff4040cc275487d464f5",
    "66bfa6a5cbdb81d8006e35c579ac137dc417eb557c77c2312b7a6f98ef4cdef6"
  ],
  "202608300003_private_starter_exercises.sql": [
    "b0e2cdc1170a9e7ef25e66378c14b10c0944b3b9a1a8c69e7b7b848bc8117165",
    "d9d7f55e4836d7f2395b15b14069b9fb31f2c56ba66d5e9171491b17741b58f5"
  ],
  "202608300004_activity_modules.sql": [
    "d53d23335d77211643340b2fc1a2f5742f6664461b3705d2e3dac76d881f0a80",
    "3ec788e42b3cf09b126975742846dba0d760d76d15d7aa97e54ac48196b3693b"
  ],
  "202608310005_private_stretches_and_sets.sql": [
    "0f4fa78c197712e13d645d1169b23b8b2dd45513b9275612a96748fa08f0247a",
    "607c9dc5610749a2792dace46994ef28b8048d9d1a56934125cdcd4479d3a5e8"
  ],
  "202608310006_workbook_import.sql": [
    "441c36de20a80eb698ebf3fd0092197ccc85d0c0ad098030f9c2583ba4ff5b1a",
    "d6e94574ac972087f25057cc2a794b0df7ffcc859c3e1c32c7ef39378d26092b"
  ],
  "202609010007_strength_load_modes_and_catalog.sql": [
    "4e5958416b0d948b82884780f8cdf1769c2810f60a498fbe762509cf1b208465",
    "7788d7a37c74e7404eed324d8db7eeee8a6acb9b3539ad0c1ecee07fda1eea63"
  ],
  "202609140008_release_announcements.sql": [
    "bf102ec310ffedc303a9b8b9194c3006c70e434c7dc34047c60f39ebda18be51",
    "0cc84a82a3252990dda6272cda8a38ccdef97b240ee0553797f1fa93e333cde2"
  ],
  "202609140009_private_groups_and_leaderboards.sql": [
    "51e12a933b512fbf6e3c62ccc7ffdfacb68bfae5f5ccae4be5aa2c1ffd627468",
    "5a3fd1c30f6f2e3a13fba8fe1687aa7de96796d96b2daffb299b4bc012b9f41a"
  ]
};
it.each(Object.entries(priorMigrationHashes))('preserves migration %s byte-for-byte', (name,expectedHashes)=>{
 const bytes=readFileSync(new URL('../../../supabase/migrations/'+name,import.meta.url));expect(expectedHashes).toContain(createHash('sha256').update(bytes).digest('hex'));
});
