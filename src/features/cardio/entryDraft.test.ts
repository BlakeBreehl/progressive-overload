import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cardioEditDraft, cardioEntryPayload } from './entryDraft'
import { saveCardioSession, type CardioSession } from './repository'

const entry: CardioSession = {id:'existing-cardio',activityId:'running',activityName:'Running',performedAt:'2020-02-03T15:23:47.123Z',durationSeconds:3723,stepCount:12345,distance:3.4,distanceUnit:'miles',speed:5.6,laps:4,incline:2,difficulty:7,notes:'retain notes',locationId:undefined}
it.each(['treadmill','stairmaster','running'])('preserves all recorded Cardio metrics when selecting %s', activityId => {
  const draft=cardioEditDraft(entry), changed={...draft,activityId}
  expect(changed).toEqual({...draft,activityId})
  expect(cardioEntryPayload(changed)).toEqual({activity_id:activityId,step_count:12345,performed_at:entry.performedAt,duration_seconds:3723,distance:3.4,distance_unit:'miles',speed:5.6,laps:4,incline:2,difficulty:7,notes:entry.notes,location_id:null})
})
it('updates the exact existing record once, leaves creation chronology alone and retains draft on failure', async () => {
  const draft={...cardioEditDraft(entry),activityId:'stairmaster'}, before=structuredClone(draft)
  const q={update:vi.fn().mockReturnThis(),insert:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{id:entry.id},error:null})}
  const client={from:vi.fn().mockReturnValue(q)} as unknown as SupabaseClient
  expect(await saveCardioSession(client,'u',cardioEntryPayload(draft),draft.id)).toBe(entry.id)
  expect(q.update).toHaveBeenCalledOnce(); expect(q.insert).not.toHaveBeenCalled()
  expect(q.eq).toHaveBeenCalledWith('id',entry.id); expect(q.eq).toHaveBeenCalledWith('user_id','u')
  expect(q.update.mock.calls[0][0]).not.toHaveProperty('created_at')
  q.single.mockResolvedValueOnce({data:null,error:new Error('failed')})
  await expect(saveCardioSession(client,'u',cardioEntryPayload(draft),draft.id)).rejects.toThrow('failed')
  expect(draft).toEqual(before)
})
it('retains explicit location and zero metrics across rapid selection and rehydration', () => {
  let draft=cardioEditDraft({...entry,locationId:'gym',speed:0,incline:0,difficulty:0,stepCount:1})
  for(const activityId of ['treadmill','stairmaster','running']) draft={...draft,activityId}
  expect(cardioEntryPayload(draft)).toMatchObject({step_count:1,speed:0,incline:0,difficulty:0,location_id:'gym',performed_at:entry.performedAt})
  expect(cardioEditDraft(entry).id).toBe(entry.id)
})

it('clears distance and its required paired unit only when distance is explicitly removed', () => {
 expect(cardioEntryPayload({...cardioEditDraft(entry),distance:undefined})).toMatchObject({distance:null,distance_unit:null,laps:4,step_count:12345,speed:5.6})
})
