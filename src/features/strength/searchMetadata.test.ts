import{describe,expect,it}from'vitest';import{exerciseLogSubtitle}from'./searchMetadata';import type{Exercise}from'./types';import repository from'./repository.ts?raw';import feature from'./StrengthFeature.tsx?raw'
const exercise=(values:Partial<Exercise>={}):Exercise=>({id:'e',userId:'u',name:'Bench',trackingType:'repetitions',majorMuscleGroups:['Chest'],muscleTags:['Mid Chest'],isCompound:true,archived:false,createdAt:'x',updatedAt:'x',usageCount:0,lastUsedAt:null,...values})
describe('Strength search metadata',()=>{
it('shows actual PR and latest entry best without a count',()=>expect(exerciseLogSubtitle(exercise({logSummary:{state:'ready',attempts:0,best:{weight:255},last:{weight:235,reps:6}},usageCount:20}),'lb')).toBe('Weight PR: 255 lb · Last: 235 lb × 6'))
it('shows a restrained unused state',()=>expect(exerciseLogSubtitle(exercise(),'lb')).toBe('No successful entries yet'))
it('loads every summary in one set query rather than N+1',()=>expect(repository.match(/from\('strength_sets'\)/g)).toHaveLength(1))
it('shows actual set-row counts only in compact management rows',()=>{const compact=feature.replace(/\s+/g,'').replace(/"/g,"'");expect(compact).toContain("exercise.usageCount===0?'Nosets'");expect(feature).toContain('divide-y divide-slate-200')})
})
