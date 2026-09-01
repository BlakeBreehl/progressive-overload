import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveWorkout } from './repository'
import type { WorkoutDraft } from './types'

describe('workout transaction failure',()=>{
  it('surfaces RPC failure without mutating entered form data',async()=>{const rpc=vi.fn().mockResolvedValue({data:null,error:new Error('transaction rolled back')});const client={rpc} as unknown as SupabaseClient;const draft:WorkoutDraft={date:'2026-08-30',locationId:null,notes:'keep this',exercises:[{key:'x',exercise:{id:'e',userId:'u',name:'Bench',trackingType:'repetitions',majorMuscleGroups:['Chest'],muscleTags:['Mid Chest'],isCompound:true,archived:false,createdAt:'',updatedAt:'',usageCount:0,lastUsedAt:null},sets:[{exerciseId:'e',setOrder:1,trackingType:'repetitions',weight:100,reps:5}]}]};const before=structuredClone(draft);await expect(saveWorkout(client,'u',draft)).rejects.toThrow('transaction rolled back');expect(draft).toEqual(before);expect(rpc).toHaveBeenCalledOnce()})
})

describe('optional workout locations',()=>{
  it('sends a cleared default location as null',async()=>{const rpc=vi.fn().mockResolvedValue({data:'workout-id',error:null});const client={rpc} as unknown as SupabaseClient;const draft:WorkoutDraft={date:'2026-08-30',locationId:null,notes:'',exercises:[{key:'x',exercise:{id:'e',userId:'u',name:'Bench',trackingType:'repetitions',majorMuscleGroups:['Chest'],muscleTags:['Mid Chest'],isCompound:true,archived:false,createdAt:'',updatedAt:'',usageCount:0,lastUsedAt:null},sets:[{exerciseId:'e',setOrder:1,trackingType:'repetitions',weight:100,reps:5}]}]};await saveWorkout(client,'u',draft);expect(rpc.mock.calls[0][1].p_workout.location_id).toBeNull()})
})
