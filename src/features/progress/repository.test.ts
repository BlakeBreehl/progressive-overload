import {expect,it,vi} from 'vitest';
import {loadCardioProgressRows} from './repository';
import {stepProgress} from '../cardio/steps';
it('loads steps beyond the default server row cap, retaining nullable values and ownership hints',async()=>{
 const rows=Array.from({length:1201},(_,i)=>({id:String(i),performed_at:'2026-09-22',step_count:i%2?null:100}));
 const select=vi.fn(),eq=vi.fn(),order=vi.fn(),range=vi.fn();const q={select:(s:string)=>{select(s);return q;},eq:(...args:unknown[])=>{eq(...args);return q;},order:(s:string)=>{order(s);return q;},range:async(a:number,b:number)=>{range(a,b);return{data:rows.slice(a,b+1),error:null};}};
 const result=await loadCardioProgressRows({from:()=>q} as never,'account-a');
 expect(result).toHaveLength(1201);expect(range.mock.calls).toEqual([[0,499],[500,999],[1000,1499]]);expect(eq).toHaveBeenCalledWith('user_id','account-a');expect(order).toHaveBeenCalledWith('id');
 expect(select.mock.calls[0][0]).toContain('!cardio_activity_owned_fk');expect(select.mock.calls[0][0]).toContain('!cardio_location_owned_fk');
 expect(stepProgress(result.map(r=>({date:r.performed_at,steps:r.step_count})),'daily')).toMatchObject({count:601,total:60100,average:100});
});
it('does not publish partial totals if a later page fails',async()=>{
 let count=0;const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>++count===1?{data:Array(500).fill({id:'fixture'}),error:null}:{data:null,error:{code:'42501'}}};
 await expect(loadCardioProgressRows({from:()=>q} as never,'a')).rejects.toMatchObject({code:'42501'});
});
