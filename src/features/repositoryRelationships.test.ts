import{describe,expect,it}from'vitest'
import type{SupabaseClient}from'@supabase/supabase-js'
import strengthSource from'./strength/repository.ts?raw'
import cardioSource from'./cardio/repository.ts?raw'
import flexibilitySource from'./flexibility/repository.ts?raw'
import progressSource from'./progress/ProgressFeature.tsx?raw'
import progressRepositorySource from'./progress/repository.ts?raw'
import{parseWorkoutRows}from'./strength/repository'
import{loadCardio,parseCardioSessions}from'./cardio/repository'
import{loadFlexibility,parseFlexEntries}from'./flexibility/repository'

const fakeClient=(responses:Record<string,{data:unknown[]|null;error:unknown}>)=>({from:(table:string)=>{const builder={select:()=>builder,eq:()=>builder,order:()=>Promise.resolve(responses[table])};return builder}})as unknown as SupabaseClient

describe('unambiguous PostgREST relationship queries',()=>{
it('uses every applicable composite ownership constraint',()=>{for(const hint of['strength_set_workout_owned_fk','strength_workout_location_owned_fk','strength_set_exercise_type_owned_fk'])expect(strengthSource).toContain(`!${hint}`);for(const hint of['cardio_activity_owned_fk','cardio_location_owned_fk'])expect(cardioSource).toContain(`!${hint}`);expect(flexibilitySource).toContain('!mobility_activity_owned_fk');expect(progressSource+progressRepositorySource).toContain('!strength_set_exercise_type_owned_fk');expect(progressSource+progressRepositorySource).toContain('!cardio_activity_owned_fk');expect(progressSource).toContain('!mobility_activity_owned_fk')})
  it('loads primary catalogs independently from paged histories',()=>{expect(strengthSource).toContain("load optional exercise usage");expect(strengthSource).not.toContain('if(useError)throw');expect(cardioSource).toContain('sessions:[] as CardioSession[]');expect(flexibilitySource).toContain('entries:[]as FlexEntry[]');expect(cardioSource).toContain('getCardioHistoryPage');expect(flexibilitySource).toContain('getFlexHistoryPage')})
})

describe('repository response parsing',()=>{
  it('accepts Strength exercises with no workouts',()=>expect(parseWorkoutRows([])).toEqual([]))
  it('accepts Cardio starters with no sessions',()=>expect(parseCardioSessions([])).toEqual([]))
  it('parses embedded Cardio activity and nullable location',()=>expect(parseCardioSessions([{id:'s',activity_id:'a',performed_at:'2026-08-31T12:00:00Z',duration_seconds:60,distance:null,distance_unit:null,speed:null,incline:null,difficulty:null,notes:null,location_id:null,activity:{name:'Running'},location:null}])).toMatchObject([{activityName:'Running',locationName:undefined,durationSeconds:60}]))
  it('supports an empty Flexibility account and legacy set backfill',()=>{expect(parseFlexEntries([],()=>[])).toEqual([]);expect(parseFlexEntries([{id:'s',activity_id:'a',performed_at:'2026-08-31T12:00:00Z',duration_seconds:30,set_count:2,notes:null,activity:{name:'Hip stretch',tracking_type:'time'}}],()=>['Hips'])).toMatchObject([{activityName:'Hip stretch',sets:[{setOrder:1,durationSeconds:30},{setOrder:2,durationSeconds:30}],areas:['Hips']}])})
  it('loads five Cardio starters with a valid empty session response',async()=>{const names=['Running','Treadmill','StairMaster',"Jacob's Ladder",'Spin Bike'];const result=await loadCardio(fakeClient({cardio_activities:{data:names.map((name,i)=>({id:String(i),name,archived:false})),error:null},cardio_sessions:{data:[],error:null}}),'u');expect(result.activities.map(x=>x.name)).toEqual(names);expect(result.sessions).toEqual([]);expect(result.warning).toBe('')})
  it('loads a Flexibility account with no activities or history',async()=>{const empty={data:[],error:null};const result=await loadFlexibility(fakeClient({mobility_activities:empty,mobility_activity_area_assignments:empty,mobility_sessions:empty}),'u');expect(result).toEqual({activities:[],entries:[],warning:''})})
})
