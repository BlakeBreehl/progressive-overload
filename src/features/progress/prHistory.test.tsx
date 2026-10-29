import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PrHistory} from './PrHistoryCard';
import {prHistory} from './prHistory';
import {loadStrengthProgressRows,type StrengthProgressRow} from './repository';
const row=(id:string,date:string,weight:number|null=100,reps=5,exercise='bench',lower=false,location:string|null=null):StrengthProgressRow=>({id,exercise_id:exercise,set_order:1,tracking_type:'repetitions',weight,reps,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:exercise,name:exercise,progression_direction:lower?'lower_is_better':'higher_is_better'},workout:{id,performed_at:date,created_at:'2026-12-31',location:location?{id:location}:null}});
describe('PRs Over Time',()=>{
 const rows=[row('first','2025-12-01'),row('weight','2026-02-01',110,8),row('rep','2026-02-02',110,9),row('tie','2026-02-03',110,9),row('attempt','2026-02-04',200,0)];
 it('counts exclusive events, excludes first entries, ties and attempts, and fills gaps',()=>{
 expect(prHistory([...rows].reverse(),'monthly')).toEqual([{period:'2025-12',weight:0,reps:0},{period:'2026-01',weight:0,reps:0},{period:'2026-02',weight:1,reps:1}]);
 expect(prHistory(rows,'yearly')).toEqual([{period:'2025',weight:0,reps:0},{period:'2026',weight:1,reps:1}]);
 });
 it('recalculates on deletion and edits',()=>{
 expect(prHistory(rows.filter(r=>r.id!=='weight'),'yearly').at(-1)).toMatchObject({weight:1,reps:0});
 expect(prHistory(rows.map(r=>r.id==='rep'?{...r,reps:8}:r),'yearly').at(-1)).toMatchObject({weight:1,reps:1});
 expect(prHistory(rows.filter(r=>r.id!=='rep'&&r.id!=='tie'),'yearly').at(-1)).toMatchObject({weight:1,reps:0});
 });
 it('uses canonical assisted, reps-only and normalized mixed-unit evidence',()=>{
 const mixed=[row('a','2026-01-01',100,5,'assist',true),row('b','2026-02-01',90,8,'assist',true),row('c','2026-01-01',null,5,'pull'),row('d','2026-02-01',null,6,'pull'),{...row('e','2026-01-01',100,5,'mixed'),weight_unit:'lb' as const},{...row('f','2026-02-01',45.359237,6,'mixed'),weight_unit:'kg' as const}];
 expect(prHistory(mixed,'yearly')).toEqual([{period:'2026',weight:1,reps:2}]);
 });
 it('uses local month/year at timestamp boundaries and preserves date-only days',()=>{
 const first=row('a','2025-12-01'),instant='2026-01-01T00:30:00Z';
 const d=new Date(instant),period=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
 expect(prHistory([first,row('b',instant,110)],'monthly').at(-1)).toMatchObject({period,weight:1});
 expect(prHistory([row('a','2026-01-01'),row('b','2026-02-01',110)],'monthly').at(-1)?.period).toBe('2026-02');
 });
 it('filters events after classification across locations',()=>{
 expect(prHistory([row('a','2026-01-01',100,5,'bench',false,'a'),row('b','2026-02-01',110,5,'bench',false,'b')],'monthly','b')).toEqual([{period:'2026-02',weight:1,reps:0}]);
 });
 it('loads and classifies all pages with account ownership',async()=>{
 const all=Array.from({length:1001},(_,i)=>row(String(i),`2026-01-01T${String(Math.floor(i/3600)).padStart(2,'0')}:${String(Math.floor(i/60)%60).padStart(2,'0')}:${String(i%60).padStart(2,'0')}Z`,100+i));
 const scopes:unknown[]=[];const q={select:()=>q,eq:(...args:unknown[])=>{scopes.push(args);return q},order:()=>q,range:async(a:number,b:number)=>({data:all.slice(a,b+1),error:null})};
 const loaded=await loadStrengthProgressRows({from:()=>q} as never,'owner');expect(loaded).toHaveLength(1001);expect(prHistory(loaded,'monthly')[0].weight).toBe(1000);expect(scopes).toContainEqual(['user_id','owner']);
 });
 it('exposes compact table text, legend and accessible controls',()=>{
 const html=renderToStaticMarkup(<PrHistory rows={rows} location="" locationLabel="All locations"/>);for(const text of ['PRs Over Time','Weight PR (green)','Rep PR (blue)','aria-pressed="true"','scroll horizontally','calendar month','All performance dates'])expect(html).toContain(text);
 });
});
