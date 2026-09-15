import {expect,it,vi} from 'vitest';
vi.mock('../../lib/supabase',()=>({supabase:null,isSupabaseConfigured:false}));
import {renderToStaticMarkup} from 'react-dom/server';
import {StrengthPointMarker} from './StrengthPointMarker';
import {StrengthProgress,StrengthTooltip} from './ProgressFeature';
import {strengthModePoints} from './strengthModes';
const rows=[225,185,235,175,240].map((weight,index)=>({id:String(index),exercise_id:'e',tracking_type:'repetitions' as const,weight,reps:5,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{name:'Bench'},workout:{performed_at:'2026-09-01',created_at:'2026-09-01',location:{id:'gym',name:'Gym'}},set_order:index}));
it('renders five independently labeled markers and matching records including both valleys',()=>{const points=strengthModePoints(rows,'e','all'),html=renderToStaticMarkup(<svg>{points.map((point,index)=><StrengthPointMarker key={point.id} cx={index*20} cy={point.result} payload={point} unit="lb" onActivate={()=>{}}/>)}</svg>);expect(html.match(/data-set-id=/g)).toHaveLength(5);expect(html.match(/tabindex="0"/g)).toHaveLength(5);expect(points.map(point=>point.result)).toEqual([225,185,235,175,240]);for(const point of points){expect(html).toContain(point.displayValue+' lb');expect(renderToStaticMarkup(<StrengthTooltip active unit="lb" payload={[{name:'Logged Sets',value:point.result,payload:point}]}/>)).toContain(point.displayValue+' lb');}});
it('activates the exact set for focus, hover, click and keyboard',()=>{const point=strengthModePoints(rows,'e','all')[3],activate=vi.fn(),marker=StrengthPointMarker({cx:10,cy:10,payload:point,unit:'lb',onActivate:activate})!;marker.props.onFocus();marker.props.onMouseEnter();marker.props.onClick();const preventDefault=vi.fn();marker.props.onKeyDown({key:'Enter',preventDefault});marker.props.onKeyDown({key:' ',preventDefault});expect(activate).toHaveBeenCalledTimes(5);expect(activate.mock.calls.every(call=>call[0]==='3')).toBe(true);});
it('keeps repeated same-day values independent under filters and conversion',()=>{const data=[...rows,{...rows[0],id:'repeat',set_order:6}];for(const unit of ['lb','kg'] as const){const points=strengthModePoints(data.reverse(),'e','all',{unit,location:'gym',start:'2026-09-01'});expect(points).toHaveLength(6);expect(new Set(points.map(point=>point.id)).size).toBe(6);expect(new Set(points.map(point=>point.date)).size).toBe(1);}expect(strengthModePoints(data,'e','all',{location:'other'})).toEqual([]);});
it('formats reps-only markers without fabricated weight',()=>{const point=strengthModePoints([{...rows[0],weight:null,reps:12}],'e','all')[0],html=renderToStaticMarkup(<svg><StrengthPointMarker payload={point} cx={0} cy={12} unit="reps" onActivate={()=>{}}/></svg>);expect(html).toContain('12 reps');expect(html).not.toMatch(/undefined|NaN|Infinity| lb| kg/);});
it('sorts actual performance timestamps before creation time and retains laps-only sets',()=>{
 const earlier={...rows[0],id:'early',workout:{...rows[0].workout,performed_at:'2026-09-01T08:00:00',created_at:'2026-09-03'}},later={...rows[1],id:'later',workout:{...rows[1].workout,performed_at:'2026-09-01T20:00:00',created_at:'2026-09-02'}};
 expect(strengthModePoints([later,earlier],'e','all').map(p=>p.id)).toEqual(['early','later']);
 const point=strengthModePoints([{...rows[0],tracking_type:'distance',weight:null,reps:null,laps:8}],'e','all')[0];expect(point).toMatchObject({result:8,displayUnit:'laps'});
});
it('uses each set metric in its tooltip even when the exercise also has weighted history',()=>{
 const point=strengthModePoints([{...rows[0],weight:null,reps:12}],'e','all')[0];
 const html=renderToStaticMarkup(<StrengthTooltip active unit="lb" payload={[{name:'Logged Sets',value:12,payload:point}]}/>);
 expect(html).toContain('12 reps');expect(html).not.toMatch(/undefined|NaN|Infinity| lb| kg|12 reps.*12 reps/);
});
it('counts Distance/Laps sets in the exercise table without fabricated repetitions or weight',()=>{
 const data=[1,2,3].map(index=>({...rows[0],id:String(index),tracking_type:'distance' as const,weight:null,reps:null,laps:index*2,exercise:{id:'e',name:'Track Laps',tracking_type:'distance'}}));
 const html=renderToStaticMarkup(<StrengthProgress rows={data} unit="lb"/>);
 expect(html).toContain('3 sets');expect(html).toContain('6 laps');expect(html).not.toContain('0 lb x');
});
