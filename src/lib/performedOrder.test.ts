import {describe,expect,it} from 'vitest';
import {orderPerformed} from './performedOrder';
describe('performed chronology',()=>{
 it('places September 1 left of September 3 even when created later',()=>{const rows=[{id:'first',performed_at:'2026-09-03',created_at:'2026-09-03T12:00:00'},{id:'second',performed_at:'2026-09-01',created_at:'2026-09-04T12:00:00'}];expect(orderPerformed(rows).map(row=>row.id)).toEqual(['second','first']);expect(rows[0].id).toBe('first');});
 it('breaks same-date ties by performed time, creation time, then ID',()=>{const rows=[{id:'z',performed_at:'2026-09-01T12:00:00',created_at:'2026-09-03'},{id:'b',performed_at:'2026-09-01T12:00:00',created_at:'2026-09-02'},{id:'a',performed_at:'2026-09-01T12:00:00',created_at:'2026-09-02'},{id:'early',performed_at:'2026-09-01T10:00:00',created_at:'2026-09-05'}];expect(orderPerformed(rows).map(row=>row.id)).toEqual(['early','a','b','z']);expect(orderPerformed([...rows].reverse())).toEqual(orderPerformed(rows));});
 it('keeps date-only midnight in the local calendar and omits invalid dates',()=>expect(orderPerformed([{id:'no',performed_at:'bad'},{id:'b',performed_at:'2026-09-01T01:00:00'},{id:'a',performed_at:'2026-09-01'}]).map(row=>row.id)).toEqual(['a','b']));
});
