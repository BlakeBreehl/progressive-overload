import {expect,it} from 'vitest';
import {detectRepetitionPrs} from './logic';
import {strengthModePoints} from '../progress/strengthModes';
import {strengthPrEvidence,type StrengthProgressRow} from '../progress/repository';
import {starterExercises} from './starterLibrary';
import {bestSet} from '../progress/logic';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StrengthProgress} from '../progress/ProgressFeature';
const rows=(values:number[][]):StrengthProgressRow[]=>values.map(([weight,reps],index)=>({id:String(index),exercise_id:'e',set_order:index,tracking_type:'repetitions',weight,reps,weight_unit:'lb',load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{id:'e',name:'Custom assistance',progression_direction:'lower_is_better'},workout:{id:'same-workout',performed_at:'2026-09-22',created_at:'2026-09-22',location:null}}));
it('awards lower assistance and exact-load rep records exclusively, including zero',()=>{const evidence=strengthPrEvidence(rows([[50,4],[40,4],[40,4],[40,8],[60,10],[0,4],[0,4],[0,8]]));expect(detectRepetitionPrs(evidence).map(pr=>pr.kinds)).toEqual([['first'],['weight'],[],['reps'],[],['weight'],[],['reps']]);expect(detectRepetitionPrs(evidence.reverse()).map(pr=>pr.kinds)).toEqual([['first'],['weight'],[],['reps'],[],['weight'],[],['reps']]);});
it('plots decreasing 4+ rep assistance independently of one-rep entries',()=>{const data=rows([[50,4],[10,1],[40,4],[45,20],[40,8],[30,3],[35,5]]);expect(strengthModePoints(data.reverse(),'e','repWeight').map(p=>p.result)).toEqual([50,40,40,35]);expect(strengthModePoints(data,'e','one')).toEqual([]);expect(strengthModePoints(data,'e','all')).toHaveLength(7);expect(strengthModePoints(data,'e','repWeight')[0].displayUnit).toBe('lb assistance');});
it('compares mixed assistance units on the canonical grid',()=>{const data=rows([[100,4],[45.359237,5],[40,4]]);data[1].weight_unit='kg';data[2].weight_unit='kg';expect(detectRepetitionPrs(strengthPrEvidence(data)).map(p=>p.kinds)).toEqual([['first'],['reps'],['weight']]);for(const unit of ['lb','kg'] as const){const points=strengthModePoints(data,'e','repWeight',{unit});expect(points[0].result).toBe(points[1].result);expect(points[2].result).toBeLessThan(points[1].result);}});
it('uses lower assistance for the best set in progress tables',()=>{const a={date:'2026-09-01',weight:40,reps:5,progressionDirection:'lower_is_better'},b={...a,weight:30};expect(bestSet([a,b])).toBe(b);});
it('installs three assisted defaults and classifies exact dips as Arms/Triceps',()=>{for(const name of ['Assisted Dip','Assisted Pull Up','Assisted Chin Up'])expect(starterExercises.find(e=>e.name===name)).toMatchObject({loadMode:'weight_reps',progressionDirection:'lower_is_better'});for(const name of ['Dip','Assisted Dip','Weighted Dip']){const exercise=starterExercises.find(e=>e.name===name)!;expect(exercise.groups[0]).toBe('Arms');expect(exercise.tags).toContain('Triceps');}});

it('invalid assistance never establishes a baseline',()=>{const evidence=strengthPrEvidence(rows([[-1,4],[40,4],[30,4]]));expect(detectRepetitionPrs(evidence).map(p=>p.kinds)).toEqual([[],['first'],['weight']]);});
it('missing assistance cannot establish a baseline or earn a rep badge',()=>{const data=rows([[50,4],[40,4],[30,4]]);data[0].weight=null;expect(detectRepetitionPrs(strengthPrEvidence(data)).map(p=>p.kinds)).toEqual([[],['first'],['weight']]);});
it('missing assistance cannot masquerade as reps-only progress or win an assistance table',()=>{const data=rows([[50,999],[40,4]]);data[0].weight=null;expect(strengthModePoints(data,'e','all').map(point=>point.id)).toEqual(['1']);const html=renderToStaticMarkup(createElement(StrengthProgress,{rows:data,unit:'lb'}));expect(html).not.toContain('999 reps');expect(html).toContain('40 lb assistance');});
it('parses original creation timestamps before ordering assisted PRs',()=>{
 const data=rows([[40,4],[50,4]]);
 data[0].workout={id:'later',performed_at:'2026-09-22',created_at:'2026-09-22T09:00:00-04:00'};
 data[1].workout={id:'earlier',performed_at:'2026-09-22',created_at:'2026-09-22T12:00:00Z'};
 expect(detectRepetitionPrs(strengthPrEvidence(data))).toEqual([{setKey:'1',kinds:['first']},{setKey:'0',kinds:['weight']}]);
});
