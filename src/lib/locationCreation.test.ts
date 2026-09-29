import {beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('../features/strength/repository',()=>({getLocations:vi.fn(),saveLocation:vi.fn(),setLocationArchived:vi.fn()}));
import {getLocations,saveLocation,setLocationArchived} from '../features/strength/repository';
import {findOrCreateLocation} from './locationCreation';
const client={} as SupabaseClient;
beforeEach(()=>vi.resetAllMocks());
it('normalizes names and selects an existing case-insensitive duplicate',async()=>{
 vi.mocked(getLocations).mockResolvedValue([{id:'gym',name:'Home Gym',isDefault:false,archived:false}]);
 await expect(findOrCreateLocation(client,'u','  HOME   gym ')).resolves.toEqual({id:'gym',name:'Home Gym',existing:true});expect(saveLocation).not.toHaveBeenCalled();
});
it('creates normalized private locations and returns their ID',async()=>{vi.mocked(getLocations).mockResolvedValue([]);vi.mocked(saveLocation).mockResolvedValue('new');await expect(findOrCreateLocation(client,'u',' New   Gym ')).resolves.toEqual({id:'new',name:'New Gym',existing:false});expect(saveLocation).toHaveBeenCalledWith(client,'u','New Gym');});
it('restores a duplicate archived location rather than duplicating it',async()=>{vi.mocked(getLocations).mockResolvedValue([{id:'gym',name:'Gym',isDefault:false,archived:true}]);await findOrCreateLocation(client,'u','Gym');expect(setLocationArchived).toHaveBeenCalledWith(client,'u','gym',false);});
it('propagates failures for inline retry without mutating the draft',async()=>{vi.mocked(getLocations).mockResolvedValue([]);vi.mocked(saveLocation).mockRejectedValue(new Error('offline'));await expect(findOrCreateLocation(client,'u','Gym')).rejects.toThrow('offline');});
it('handles a concurrent duplicate insert by selecting the matching location',async()=>{vi.mocked(getLocations).mockResolvedValueOnce([]).mockResolvedValueOnce([{id:'gym',name:'Gym',archived:false,isDefault:false}]);vi.mocked(saveLocation).mockRejectedValue(new Error('duplicate'));expect((await findOrCreateLocation(client,'u','Gym')).id).toBe('gym');});
