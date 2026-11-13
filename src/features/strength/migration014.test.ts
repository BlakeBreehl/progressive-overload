import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const sql=readFileSync('supabase/migrations/202611130014_nested_strength_drop_sets.sql','utf8')
const recovery=sql.slice(sql.indexOf('DO $migration_014$'),sql.indexOf('DO $postflight_014$'))
const postflight=sql.slice(sql.indexOf('DO $postflight_014$'))
const contracts=(name:string,source=sql)=>JSON.parse(source.match(new RegExp(`${name} constant jsonb := \\$contract\\$([\\s\\S]*?)\\$contract\\$`))![1])
type Column={name:string;type:string;notnull:boolean;default:string|null;ddl:string}
type Constraint={table:string;name:string;kind:string;cols?:string[];refcols?:string[];target?:string;delete?:string;update?:string;expr?:string;boolops?:string[];ddl:string}
const columns=contracts('v_columns') as Column[]
const constraints=contracts('v_constraints') as Constraint[]

// Execute only the portable string transformations extracted from each SQL validator.
// This exercises the checked-in patterns without executing SQL or contacting a database.
const normalizationBody=(source:string)=>source.match(/v_expression := pg_get_expr\(v_constraint.conbin,v_constraint.conrelid\);([\s\S]*?)v_expected :=/)![1]
const sqlString=(quoted:string)=>quoted.slice(1,-1).replaceAll("''", "'")
const portableRegex=(pattern:string)=>new RegExp(pattern.replaceAll('[:space:]','\\s').replaceAll('\\y','\\b'),'g')
function normalizeCheck(expression:string,source:string){
  const operations=[...normalizationBody(source).matchAll(/v_expression := (regexp_replace|replace)\(v_expression,('(?:''|[^'])*'),('(?:''|[^'])*')(?:,('(?:''|[^'])*'))?\);/g)]
  expect(operations).toHaveLength(4)
  return operations.reduce((value,operation)=>operation[1]==='replace'
    ?value.replaceAll(sqlString(operation[2]),sqlString(operation[3]))
    :value.replace(portableRegex(sqlString(operation[2])),sqlString(operation[3])),expression)
}
const repsExpression=(bound="(('9007199254740991'::bigint)::numeric)")=>`((reps >= (0)::numeric) AND (reps <= ${bound}) AND (reps = trunc(reps)) AND ((reps)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))`
const weightExpression="((weight IS NULL) OR ((weight >= (0)::numeric) AND ((weight)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))))"
function acceptsCheck(name:string,expression:string,nodeTree:string,source:string){
  const spec=constraints.find(c=>c.name===name)!
  const booleanPattern=source.match(/regexp_matches\(v_constraint.conbin::text,'([^']+)','g'\)/)![1]
  const boolops=[...nodeTree.matchAll(portableRegex(booleanPattern))].map(match=>match[1])
  return normalizeCheck(expression,source)===spec.expr!.replace(/[\s()]/g,'')&&JSON.stringify(boolops)===JSON.stringify(spec.boolops)
}

describe.each([['installation preflight',recovery],['independent postflight',postflight]])('%s check-expression regression',(_label,source)=>{
  it('accepts the exact reported bigint-to-numeric upper-bound expression',()=>{
    expect(acceptsCheck('strength_drop_sets_reps_check',repsExpression(),'{BOOLEXPR :boolop and :args (...) }',source)).toBe(true)
  })
  it.each(['9007199254740991',"'9007199254740991'::numeric","(('9007199254740991'::pg_catalog.bigint)::numeric)","(('9007199254740991' :: int8) :: pg_catalog.numeric)"])
  ('accepts lossless formatting of the same literal: %s',bound=>{
    expect(acceptsCheck('strength_drop_sets_reps_check',repsExpression(bound),':boolop and',source)).toBe(true)
  })
  it.each([
    repsExpression("(('9007199254740992'::bigint)::numeric)"),
    repsExpression('9007199254740990'),
    repsExpression().replace('reps >= (0)','reps > (0)'),
    repsExpression().replace('reps = trunc(reps)','reps >= trunc(reps)'),
    repsExpression().replace('reps = trunc(reps)','reps::bigint = trunc(reps)'),
    repsExpression().replace('reps <=','reps::bigint <='),
    repsExpression().replace("::bigint)::numeric)","::bigint)::numeric + 1)"),
    repsExpression().replace("'Infinity'::text","'infinity'::text"),
  ])('rejects genuinely different numeric/finite/whole-rep constraints: %s',expression=>{
    expect(acceptsCheck('strength_drop_sets_reps_check',expression,':boolop and',source)).toBe(false)
  })
  it('retains ordered Boolean-tree validation and rejects regrouping hidden by parentheses removal',()=>{
    const regrouped="(((weight IS NULL) OR (weight >= (0)::numeric)) AND ((weight)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))"
    expect(normalizeCheck(regrouped,source)).toBe(normalizeCheck(weightExpression,source))
    expect(acceptsCheck('strength_drop_sets_weight_check',weightExpression,':boolop or :args ({BOOLEXPR :boolop and})',source)).toBe(true)
    expect(acceptsCheck('strength_drop_sets_weight_check',regrouped,':boolop and :args ({BOOLEXPR :boolop or})',source)).toBe(false)
    for(const tree of [':boolop or',':boolop not :boolop and',':boolop and :boolop or'])
      expect(acceptsCheck('strength_drop_sets_reps_check',repsExpression(),tree,source)).toBe(false)
    expect(source).toContain('array_agg(m.parts[1] order by m.ordinality)')
    expect(source).toContain('with ordinality m(parts,ordinality)')
  })
})

describe('014 resumable migration source contracts (SQL is never executed)',()=>{
  it('has two complete independently atomic DO statements and no session-local objects',()=>{
    expect(sql.match(/^DO \$/gm)).toHaveLength(2)
    expect(sql).toContain('END\n$migration_014$;')
    expect(sql.trim()).toMatch(/END\s+\$postflight_014\$;$/)
    expect(sql).not.toMatch(/create\s+(?:temp|temporary)\s+table|pg_temp|\bset\s+local\b|\bon\s+commit\s+drop\b/i)
    expect(sql).not.toMatch(/cardio_013_snapshot|strength_014_workouts_before|strength_014_sets_before/i)
    const prior=readdirSync('supabase/migrations').filter(name=>/^\d{8}00(?:0[1-9]|1[0-3])_/.test(name)).map(name=>readFileSync(`supabase/migrations/${name}`,'utf8')).join('\n')
    for(const match of prior.matchAll(/create\s+(?:temp|temporary)\s+table\s+(\w+)/gi))expect(sql).not.toContain(match[1])
  })
  it('runs the complete read-only preflight before any installation and asserts post-013 prerequisites',()=>{
    expect(recovery).toContain("array['preflight','install','postflight']")
    expect(recovery.indexOf('014 prerequisite')).toBeLessThan(recovery.indexOf("array['preflight','install','postflight']"))
    for(const source of [recovery,postflight]){
      for(const table of ['strength_sets','strength_workouts','exercises','groups','group_members','group_progress_privacy','cardio_sessions','cardio_activities'])expect(source).toContain(`"table":"${table}"`)
      expect(source).toContain('014 prerequisite column missing/incompatible')
      expect(source).toContain('to_regtype')
    }
  })
  it('validates every existing column and adds missing columns only to an empty table',()=>{
    expect(columns.map(c=>c.name)).toEqual(['id','parent_set_id','user_id','workout_id','exercise_id','tracking_type','drop_order','weight','weight_unit','reps','created_at'])
    expect(columns.find(c=>c.name==='weight')).toMatchObject({type:'numeric',notnull:false,default:null})
    expect(columns.find(c=>c.name==='id')).toMatchObject({type:'uuid',notnull:true,default:'gen_random_uuid()'})
    for(const field of ['atttypid','atttypmod','attnotnull','attidentity','attgenerated','default_expression'])expect(recovery).toContain(field)
    expect(recovery).toContain("v_phase='postflight' or v_populated")
    expect(recovery).toContain('unexpected column; review manually')
    expect(recovery).toContain("if v_phase='install' then execute format('alter table public.strength_drop_sets add column")
  })
  it('checks required unique, primary, check and ownership constraints by catalog and ordered keys',()=>{
    expect(constraints).toHaveLength(9)
    expect(constraints.find(c=>c.name==='strength_main_drop_owner_key')).toMatchObject({kind:'u',cols:['id','user_id','workout_id','exercise_id','tracking_type']})
    expect(constraints.find(c=>c.name==='strength_drop_parent_owned_fk')).toMatchObject({kind:'f',cols:['parent_set_id','user_id','workout_id','exercise_id','tracking_type'],target:'public.strength_sets',refcols:['id','user_id','workout_id','exercise_id','tracking_type'],delete:'c',update:'c'})
    expect(constraints.find(c=>c.kind==='p')?.cols).toEqual(['id'])
    expect(constraints.find(c=>c.name==='strength_drop_sets_parent_set_id_drop_order_key')?.cols).toEqual(['parent_set_id','drop_order'])
    for(const field of ['pg_catalog.pg_constraint','contype','conkey','confkey','confrelid','confdeltype','confupdtype','confmatchtype','convalidated','condeferrable','conbin'])expect(recovery).toContain(field)
    expect(recovery).toContain('014 incompatible ordered constraint columns')
    expect(recovery).toContain('014 incompatible check expression')
    expect(recovery).toContain(':boolop (and|or|not)')
    expect(recovery).toContain("if v_phase='install' then execute format('alter table public.%I add constraint")
  })
  it('keeps finite nonnegative and whole-rep checks including zero attempts',()=>{
    expect(constraints.find(c=>c.name==='strength_drop_sets_drop_order_check')?.ddl).toBe('check(drop_order>0)')
    expect(constraints.find(c=>c.name==='strength_drop_sets_reps_check')?.ddl).toContain('reps>=0 and reps<=9007199254740991 and reps=trunc(reps)')
    expect(constraints.find(c=>c.name==='strength_drop_sets_weight_check')?.ddl).toContain("weight::text not in ('NaN','Infinity','-Infinity')")
  })
  it('catalog-checks an existing index rather than trusting IF NOT EXISTS',()=>{
    expect(recovery).toContain("to_regclass('public.strength_drop_user_parent_idx')")
    expect(recovery).toContain("array['user_id','parent_set_id']")
    for(const field of ['indrelid','indkey','indisunique','indisvalid','indisready','indnatts','indnkeyatts','indexprs','indpred','indoption','indcollation','indclass','uuid_ops'])expect(recovery).toContain(field)
    expect(recovery).toContain("if v_phase='install' then create index strength_drop_user_parent_idx")
    expect(recovery).toContain('014 incompatible strength_drop_user_parent_idx definition')
  })
  it('retains exact compatible owned-row policies and never drops unrelated policies',()=>{
    const policies=contracts('v_policies') as {name:string;cmd:string;gate:string}[]
    expect(policies.map(p=>p.name)).toEqual(['strength_drop_select','strength_drop_insert','strength_drop_update','strength_drop_delete'])
    expect(policies.find(p=>p.cmd==='w')?.gate).toBe('using(user_id=auth.uid()) with check(user_id=auth.uid())')
    expect(recovery).toContain('enable row level security')
    expect(recovery).toContain('polroles<>array[v_authenticated]')
    expect(recovery).toContain('polpermissive')
    expect(recovery).not.toMatch(/drop\s+policy/i)
    expect(recovery).toContain('014 unrelated policy weakens ownership')
    expect(recovery).toContain('014 incompatible policy WITH CHECK')
  })
  it('replaces all three functions and atomically normalizes the known trigger',()=>{
    for(const name of ['enforce_strength_drop_load_mode','save_strength_workout','private_group_summary'])expect(recovery).toContain(`create or replace function public.${name}`)
    expect(recovery).toMatch(/drop trigger if exists strength_drop_load_mode on public\.strength_drop_sets;\s+create trigger strength_drop_load_mode before insert or update/)
    expect(recovery).toContain('Drop set not found or duplicate ID')
    expect(recovery).toContain('parent_set_id=v_set_id and user_id=v_user_id and workout_id=v_workout_id')
    expect(recovery).toContain('014 incompatible function signature/owner')
  })
  it('never executes row writes or recreates/truncates tables during migration',()=>{
    const withoutDefinitions=sql.replace(/execute \$definition_\d\$[\s\S]*?\$definition_\d\$;/g,'')
    expect(withoutDefinitions).not.toMatch(/\b(?:insert\s+into|update|delete\s+from|truncate|drop\s+table)\s+public\.(?:strength_workouts|strength_sets|strength_drop_sets)\b/i)
    expect(withoutDefinitions).not.toMatch(/execute\s+['"$][^;]*(?:update|delete\s+from|insert\s+into)/i)
    expect(sql).not.toMatch(/^\s*(?:drop\s+table|truncate\s+(?:table\s+)?public\.strength_drop_sets)\b/im)
    expect(recovery).toMatch(/if v_drop is null then[\s\S]*?if v_phase='install' then\s+create table public\.strength_drop_sets/)
  })
  it('reapplies minimal ACLs including column grants and disallows anon/public or grant options',()=>{
    expect(recovery).toContain('revoke all on public.strength_drop_sets from public,anon,authenticated')
    expect(recovery).toContain('revoke all privileges (%s) on table public.strength_drop_sets from public,anon,authenticated')
    expect(recovery).toContain('grant select,insert,update,delete on public.strength_drop_sets to authenticated')
    expect(postflight).toContain("has_any_column_privilege('anon'")
    expect(postflight).toContain('a.grantee=0')
    expect(postflight).toContain('a.is_grantable')
    expect(postflight).toContain("has_function_privilege('anon'")
    expect(postflight).toContain("array['TRUNCATE','REFERENCES','TRIGGER']")
    expect(recovery).not.toMatch(/grant\s+[^;]+\s+to\s+(?:public|anon)\b/i)
  })
  it('has a final standalone postflight with the same schema contracts and complete assertions',()=>{
    expect(normalizationBody(postflight)).toBe(normalizationBody(recovery))
    for(const name of ['v_columns','v_constraints','v_policies','v_functions'])expect(contracts(name,postflight)).toEqual(contracts(name,recovery))
    for(const assertion of ['strength_drop_sets missing','required index missing','RLS is not enabled','expected four known policies','load-mode trigger definition differs','function security/search_path/language differs','function privileges differ','authenticated missing','public/anon table or column access'])expect(postflight).toContain(assertion)
    expect(postflight).toContain('tgtype=23')
    expect(postflight).toContain("tgenabled='O'")
    expect(postflight).toContain('Migration 014 postflight passed')
    expect(postflight).not.toMatch(/^\s*(?:create|alter|drop|grant|revoke)\s+(?:table|index|trigger|policy|function)\b/im)
  })
  it('keeps group set totals main-only and PR performance source expanded',()=>{
    const counted=sql.slice(sql.indexOf('with counted as'),sql.indexOf('-- Mirror the exclusive'))
    expect(counted).toContain('join public.strength_sets')
    expect(counted).not.toContain('strength_drop_sets')
    expect(sql).toContain('from public.strength_drop_sets d join public.strength_sets m')
  })
})
