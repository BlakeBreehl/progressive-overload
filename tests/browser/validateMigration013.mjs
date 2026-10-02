// Disposable embedded PostgreSQL only. Never connects to Supabase or reads .env.
import {pathToFileURL} from 'node:url';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const base=process.env.PGLITE_MODULE_ROOT;
const {PGlite}=await import(pathToFileURL(base+'/dist/index.js').href);
const {pgcrypto}=await import(pathToFileURL(base+'/dist/contrib/pgcrypto.js').href);
const db=new PGlite({extensions:{pgcrypto}}),checks=[];
const assert=(pass,name)=>{if(!pass)throw Error(name);checks.push(name)};
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}',role text DEFAULT 'authenticated');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
 const files=(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
 for(const file of files.filter(n=>!n.includes('0013_'))){await db.exec(await readFile('supabase/migrations/'+file,'utf8'));checks.push('Disposable setup '+file);}
 await db.exec(`INSERT INTO auth.users(id) VALUES ('${a}');
 INSERT INTO public.cardio_sessions(user_id,activity_id,performed_at,duration_seconds,step_count,notes)
 SELECT '${a}',id,'2026-08-01T12:00:00Z',600,55,'existing timed evidence' FROM public.cardio_activities WHERE user_id='${a}' AND name='Running';`);
 const before=(await db.query('SELECT id,to_jsonb(s) original FROM public.cardio_sessions s ORDER BY id')).rows;
 await db.exec(await readFile('docs/STRENGTH_STEPS_013_STATUS.sql','utf8'));
 await db.exec(await readFile('docs/STRENGTH_STEPS_013_PREFLIGHT.sql','utf8'));
 checks.push('Read-only status/preflight run before 013');
 await db.exec(await readFile('supabase/migrations/202609300013_cardio_steps_activity.sql','utf8'));
 const after=(await db.query("SELECT id,to_jsonb(s)-'tracking_mode' original FROM public.cardio_sessions s ORDER BY id")).rows;
 assert(JSON.stringify(before)===JSON.stringify(after),'Original timed records preserved exactly');
 await db.exec(`INSERT INTO auth.users(id) VALUES ('${b}')`);
 assert((await db.query("SELECT count(*)::int n FROM public.cardio_activities WHERE tracking_mode='steps'")).rows[0].n===2,'Existing and future account Steps starters');
 await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.cardio_activities,public.cardio_sessions TO authenticated;
 SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`);
 const activity=(await db.query("SELECT id FROM public.cardio_activities WHERE tracking_mode='steps'")).rows;
 assert(activity.length===1,'RLS exposes own Steps starter only');
 await db.exec(`INSERT INTO public.cardio_sessions(user_id,activity_id,performed_at,tracking_mode,step_count) VALUES ('${a}','${activity[0].id}','2026-09-30T12:00:00Z','steps',10542)`);
 assert((await db.query("SELECT step_count,duration_seconds FROM public.cardio_sessions WHERE tracking_mode='steps'")).rows[0].duration_seconds===null,'Steps write has null duration');
 async function reject(sql,name){try{await db.exec(sql)}catch{checks.push(name);return}throw Error('Unexpected accepted write: '+name)}
 // Text/API integer input rejects fractions; explicit SQL numeric-to-integer casts round by PostgreSQL design.
 for(const count of ['0','-1',"'1.5'",'NULL'])await reject(`INSERT INTO public.cardio_sessions(user_id,activity_id,performed_at,tracking_mode,step_count) VALUES ('${a}','${activity[0].id}',now(),'steps',${count})`,'Reject steps '+count);
 await reject(`UPDATE public.cardio_sessions SET duration_seconds=10 WHERE tracking_mode='steps'`,'Reject timed Steps metric');
 await reject(`UPDATE public.cardio_activities SET tracking_mode='timed' WHERE tracking_mode='steps'`,'Reject activity reinterpretation');
 await reject(`SELECT public.install_private_steps_activity('${a}')`,'Browser denied installer execution');
 await db.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false)`);
 assert((await db.query('SELECT * FROM public.cardio_sessions')).rows.length===0,'Second account cannot read first account entries');
 await reject(`INSERT INTO public.cardio_sessions(user_id,activity_id,performed_at,tracking_mode,step_count) VALUES ('${b}','${activity[0].id}',now(),'steps',20)`,'Reject foreign account activity');
 await db.exec('RESET ROLE');
 const group='33333333-3333-4333-8333-333333333333';
 await db.exec(`INSERT INTO public.groups(id,owner_user_id,name) VALUES ('${group}','${a}','Disposable QA');
 INSERT INTO public.group_members(group_id,user_id,role,display_name) VALUES ('${group}','${a}','owner','Fixture');
 SELECT set_config('request.jwt.claim.sub','${a}',false);`);
 const summary=(await db.query(`SELECT public.private_group_summary('${group}','year','America/New_York') summary`)).rows[0].summary;
 assert(summary.cardio.length===1&&summary.cardio[0].duration_seconds===600&&summary.activities.length===1,'Group RPC keeps timed totals and excludes Steps');
 await db.exec(await readFile('docs/STRENGTH_STEPS_013_STATUS.sql','utf8'));
 checks.push('Read-only status runs after 013');
 await db.exec(await readFile('docs/STRENGTH_STEPS_013_POSTFLIGHT.sql','utf8'));
 checks.push('Read-only postflight parses and runs');
 await writeFile('docs/migration013-disposable-results.json',JSON.stringify({engine:'PGlite embedded PostgreSQL',liveDatabase:false,checks},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,passed:true}));
}catch(error){console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where,checks}));process.exitCode=1;}finally{await db.close()}
