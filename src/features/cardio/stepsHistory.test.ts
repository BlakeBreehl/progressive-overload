import {expect,it,vi} from 'vitest';
import {getCardioHistoryPage} from './repository';
it('pages and filters Steps with account ownership and local calendar date boundaries',async()=>{
 const eq=vi.fn(),gte=vi.fn(),lte=vi.fn(),range=vi.fn(),ilike=vi.fn(),order=vi.fn();
 const row={id:'steps-entry',activity_id:'steps',performed_at:'2026-09-30T23:00:00',tracking_mode:'steps',step_count:10542,duration_seconds:null,activity:{name:'Steps'},location:null};
 const q={select(){return q},eq(...args:unknown[]){eq(...args);return q},gte(...args:unknown[]){gte(...args);return q},lte(...args:unknown[]){lte(...args);return q},ilike(...args:unknown[]){ilike(...args);return q},order(...args:unknown[]){order(...args);return q},range(a:number,b:number){range(a,b);return Promise.resolve({data:[row],count:41,error:null})}};
 const result=await getCardioHistoryPage({from:()=>q} as never,'account-a',{page:2,pageSize:20,activityId:'steps',search:'Steps',start:'2026-09-30',end:'2026-09-30'});
 expect(eq).toHaveBeenCalledWith('user_id','account-a');expect(eq).toHaveBeenCalledWith('activity_id','steps');expect(ilike).toHaveBeenCalledWith('activity.name','%Steps%');expect(range).toHaveBeenCalledWith(20,39);
 expect(gte).toHaveBeenCalledWith('performed_at',new Date('2026-09-30T00:00:00').toISOString());expect(lte).toHaveBeenCalledWith('performed_at',new Date('2026-09-30T23:59:59.999').toISOString());
 expect(order.mock.calls.map(args=>args[0])).toEqual(['performed_at','created_at','id']);expect(result.total).toBe(41);expect(result.items[0]).toMatchObject({id:'steps-entry',trackingMode:'steps',stepCount:10542,durationSeconds:null});
});
