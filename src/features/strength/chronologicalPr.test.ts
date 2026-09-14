import { describe, expect, it } from 'vitest';
import { detectRepetitionPrs, type TimedSet } from './logic';
const set=(id:string,overrides:Partial<TimedSet>={}):TimedSet=>({id,workoutId:id,exerciseId:'bench',performedAt:'2026-01-02',createdAt:'2026-01-02',setOrder:1,trackingType:'repetitions',weight:100,reps:5,...overrides});
const badges=(sets:TimedSet[])=>Object.fromEntries(detectRepetitionPrs(sets).map(row=>[row.setKey,row.kinds]));
describe('historical achievement chronology',()=>{
  it('marks only the first entry and suppresses achievements on its later sets',()=>{
    expect(badges([set('b',{workoutId:'a',setOrder:2,weight:120}),set('a')])).toEqual({a:['first'],b:[]});
  });
  it('uses creation time before set order and a stable ID for complete ties',()=>{
    expect(badges([set('b'),set('a')])).toEqual({a:['first'],b:[]});
    expect(badges([set('a'),set('z',{createdAt:'2026-01-01',setOrder:9})]).z).toEqual(['first']);
  });
  it('uses performance date before creation date, even for backdated entries',()=>{
    const result=badges([set('later',{weight:110}),set('backdated',{performedAt:'2025-01-01',createdAt:'2026-05-01'})]);
    expect(result.backdated).toEqual(['first']);expect(result.later).toEqual(['weight']);
  });
  it('requires exact-weight prior evidence and gives weight priority',()=>{
    const result=badges([set('a'),set('b',{performedAt:'2026-01-03',weight:110,reps:8}),set('c',{performedAt:'2026-01-04',weight:90,reps:20})]);
    expect(result.b).toEqual(['weight']);expect(result.c).toEqual([]);
  });
  it('supports reps-only records without weight badges',()=>{
    expect(badges([set('a',{weight:undefined}),set('b',{performedAt:'2026-01-03',weight:undefined,reps:6})])).toEqual({a:['first'],b:['reps']});
  });
});
