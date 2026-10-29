import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StrengthProgress} from './ProgressFeature';
import {ChartControls,defaultAxisSettings} from '../../components/ChartControls';
import type {StrengthProgressRow} from './repository';
vi.mock('../../lib/supabase',()=>({supabase:null,isSupabaseConfigured:false}));
const rows:StrengthProgressRow[]=[{id:'a',exercise_id:'bench',tracking_type:'repetitions',weight:100,reps:5,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'bench',name:'Bench Press'},workout:{id:'a',performed_at:'2026-10-01',created_at:'2026-10-01',location:null}}];
it('renders heading, one PR history card, then exercise graph and remaining sections',()=>{
 const html=renderToStaticMarkup(<StrengthProgress rows={rows} unit="lb"/>);
 expect(html.indexOf('Strength Progress</h2>')).toBeLessThan(html.indexOf('aria-label="PRs Over Time"'));
 expect(html.indexOf('aria-label="PRs Over Time"')).toBeLessThan(html.indexOf('aria-label="Strength exercise graph"'));
 expect(html.match(/aria-label="PRs Over Time"/g)).toHaveLength(1);
 const graph=html.slice(html.indexOf('aria-label="Strength exercise graph"'));
 const panel=graph.slice(graph.indexOf('<details'),graph.indexOf('</details>'));
 expect(panel).not.toMatch(/<details[^>]*\sopen[\s=>]/);
 for(const label of ['Location','Graph mode','Time period','Y minimum','Y maximum','Reset to Auto'])expect(panel).toContain(label);
 expect(graph.slice(0,graph.indexOf('<details'))).toContain('>Exercise<input');
 expect(panel).not.toContain('>Exercise<input');
 for(const label of ['Location','Graph mode','Time period'])expect(graph.match(new RegExp(`>${label}<`,'g'))).toHaveLength(1);
});
it('moves custom range, axes and reset inside the panel while keeping other modules range placement',()=>{
 const settings={...defaultAxisSettings,range:'custom' as const,start:'2026-01-01',end:'2026-12-31'};
 const render=(inside:boolean)=>renderToStaticMarkup(<ChartControls settings={settings} setSettings={()=>{}} unit="lb" rangeInside={inside}/>);
 const inside=render(true);expect(inside.indexOf('Time period')).toBeGreaterThan(inside.indexOf('<details'));
 for(const label of ['Start date','End date','Y minimum','Y maximum','Reset to Auto'])expect(inside.indexOf(label)).toBeGreaterThan(inside.indexOf('<details'));
 const outside=render(false);expect(outside.indexOf('Time period')).toBeLessThan(outside.indexOf('<details'));
});
