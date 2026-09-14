import { describe,expect,it } from 'vitest';
import { strengthModePoints } from './strengthModes';
import type { StrengthProgressRow } from './repository';
const row=(id:string,day:number,weight:number|null,reps:number):StrengthProgressRow=>({id,exercise_id:'e',tracking_type:'repetitions',weight,reps,set_order:1,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'e'},workout:{performed_at:`2026-01-${String(day).padStart(2,'0')}T12:00:00`,created_at:'2026-01-01',location:{id:'gym',name:'Gym'}}});
const rows=[row('a',1,100,5),row('b',2,110,1),row('c',3,105,4),row('d',4,105,6),row('e',5,90,5),row('f',6,115,1),row('g',7,115,1),row('h',8,100,1)];
describe('actual Strength graph modes',()=>{
  it('PRs contain only strictly increasing weight and 3+ rep events',()=>{
    const points=strengthModePoints(rows,'e','prs');
    expect(points.filter(p=>p.result!==null).map(p=>p.result)).toEqual([100,110,115]);
    expect(points.filter(p=>p.three!==null).map(p=>p.three)).toEqual([100,105]);
    expect(points.some(p=>p.id==='d'||p.id==='e')).toBe(false);
  });
  it('one-rep mode uses only actual increasing exactly-one-rep sets',()=>{
    const points=strengthModePoints(rows,'e','one');expect(points.map(p=>p.id)).toEqual(['b','f']);expect(points.every(p=>p.reps===1)).toBe(true);
  });
  it('Rep Weight preserves lower later sets with at least three reps',()=>expect(strengthModePoints(rows,'e','repWeight').map(p=>p.id)).toEqual(['a','c','d','e']));
  it('All Logged Sets retains every independent matching set',()=>{
    const data=[...rows,row('same-day',8,95,5)];expect(strengthModePoints(data,'e','all')).toHaveLength(9);
    expect(strengthModePoints(data,'e','all',{start:'2026-01-08'})).toHaveLength(2);
  });
  it('recalculates backdated history before applying range or location filters',()=>{
    expect(strengthModePoints([...rows,row('older',1,200,5)],'e','prs',{start:'2026-01-02'})).toEqual([]);
    expect(strengthModePoints(rows,'e','all',{location:'elsewhere'})).toEqual([]);
  });
  it('adapts reps-only modes and never fabricates a one-rep weight',()=>{
    const data=[row('a',1,null,5),row('b',2,null,4),row('c',3,null,6)];
    expect(strengthModePoints(data,'e','prs').map(p=>p.result)).toEqual([5,6]);
    expect(strengthModePoints(data,'e','one')).toEqual([]);
    expect(strengthModePoints(data,'e','repWeight')).toHaveLength(3);
  });
  it('keeps source values and records unchanged',()=>{const before=structuredClone(rows);for(const mode of ['prs','one','repWeight','all'] as const)strengthModePoints(rows,'e',mode);expect(rows).toEqual(before);});
});
