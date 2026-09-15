import {describe,expect,it} from 'vitest';
import {comparisonWeight,convertWeight,displayWeight,normalizeReadings} from './weightUnits';
import {detectRepetitionPrs,type TimedSet} from '../features/strength/logic';
import {strengthModePoints} from '../features/progress/strengthModes';
import {dailyAverages} from '../features/weight/logic';
import {bodyweightChart} from '../features/weight/chart';
describe('display conversion and unit-independent comparisons',()=>{
 it('converts both directions while preserving same-unit values',()=>{expect(convertWeight(100,'lb','kg')).toBe(45.359237);expect(convertWeight(1,'kg','lb')).toBe(2.2046226218);expect(displayWeight(185.1234567,'lb','lb')).toBe('185.1234567');});
 it('keeps mixed Bodyweight graphs visible and averages normalized in either preference',()=>{
  const rows=[{id:'a',weight:100,unit:'lb' as const,period:'morning' as const,measuredAt:'2026-09-01T08:00:00'},{id:'b',weight:45.359237,unit:'kg' as const,period:'evening' as const,measuredAt:'2026-09-01T18:00:00'}],before=structuredClone(rows);
  for(const unit of ['kg','lb'] as const){const normalized=normalizeReadings(rows,unit);expect(bodyweightChart(normalized)).toHaveLength(2);expect(dailyAverages(normalized)[0].weight).toBeCloseTo(unit==='kg'?45.359237:100,6);}expect(rows).toEqual(before);
 });
 it('uses equivalent actual loads for Rep PR, not rounded display values',()=>{
  const set=(id:string,weight:number,weightUnit:'lb'|'kg',reps:number):TimedSet=>({id,workoutId:id,exerciseId:'e',performedAt:`2026-09-0${id}T12:00:00`,setOrder:1,trackingType:'repetitions',weight,weightUnit,reps});
  const rows=[set('1',100,'lb',5),set('2',45.359237,'kg',6),set('3',46,'kg',3),set('4',100,'lb',6)];
  expect(detectRepetitionPrs(rows).map(row=>row.kinds)).toEqual([['first'],['reps'],['weight'],[]]);
  expect(comparisonWeight(2.2046226218,'lb')).toBe(comparisonWeight(1,'kg'));
 });
 it('keeps Strength graph events invariant under unit preference',()=>{
  const rows=[{id:'a',exercise_id:'e',tracking_type:'repetitions' as const,weight:100,weight_unit:'lb' as const,reps:5,set_order:1,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'e'},workout:{performed_at:'2026-09-01',created_at:'2026-09-01',location:null}},{id:'b',exercise_id:'e',tracking_type:'repetitions' as const,weight:46,weight_unit:'kg' as const,reps:3,set_order:1,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'e'},workout:{performed_at:'2026-09-02',created_at:'2026-09-02',location:null}}];
  const before=structuredClone(rows),kg=strengthModePoints(rows,'e','all',{unit:'kg'}),lb=strengthModePoints(rows,'e','all',{unit:'lb'});
  expect(kg.map(p=>p.id)).toEqual(lb.map(p=>p.id));expect(kg[0].result).toBe(45.359237);expect(lb[1].result).toBeCloseTo(101.41264,4);expect(rows).toEqual(before);
 });
});
