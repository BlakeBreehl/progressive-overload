import {expect,it,vi} from 'vitest';
import {acknowledgeRelease,markShown,releaseId,shouldAnnounce,shownThisSession} from './releaseAnnouncement';
it('waits for account readiness and scopes durable lookup to that account',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:null,error:null}))};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);const client={from:vi.fn(()=>query)};
  expect(await shouldAnnounce(client as never,'ready-user',false)).toBe(false);expect(client.from).not.toHaveBeenCalled();
  expect(await shouldAnnounce(client as never,'ready-user',true)).toBe(true);expect(query.eq).toHaveBeenCalledWith('user_id','ready-user');expect(query.eq).toHaveBeenCalledWith('release_id',releaseId);
  markShown('ready-user');expect(await shouldAnnounce(client as never,'ready-user',true)).toBe(false);expect(shownThisSession('different-user')).toBe(false);
});
it('does not repeat acknowledged releases on another device',async()=>{
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{release_id:releaseId},error:null})};expect(await shouldAnnounce({from:()=>query} as never,'durable-user',true)).toBe(false);
});
it('inserts only a private acknowledgement and remains usable on persistence failure',async()=>{
  const insert=vi.fn(async()=>{throw new Error('offline');});await expect(acknowledgeRelease({from:()=>({insert})} as never,'offline-user')).resolves.toBeUndefined();expect(insert).toHaveBeenCalledWith({user_id:'offline-user',release_id:releaseId});expect(shownThisSession('offline-user')).toBe(true);
});
