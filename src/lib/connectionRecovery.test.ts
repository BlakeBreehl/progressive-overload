import {expect,it,vi} from 'vitest';
import {watchConnectionRecovery} from './connectionRecovery';
it('recovers on connection restoration or iOS-style resume, then cleans up on account change',()=>{
 const win=new EventTarget(),doc=Object.assign(new EventTarget(),{visibilityState:'hidden'}),retry=vi.fn();let online=false;
 const stop=watchConnectionRecovery(retry,win,doc,()=>online);
 win.dispatchEvent(new Event('online'));expect(retry).not.toHaveBeenCalled();online=true;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));expect(retry).toHaveBeenCalledOnce();win.dispatchEvent(new Event('online'));expect(retry).toHaveBeenCalledTimes(2);stop();win.dispatchEvent(new Event('online'));doc.dispatchEvent(new Event('visibilitychange'));expect(retry).toHaveBeenCalledTimes(2);
});
