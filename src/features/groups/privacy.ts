import type {SupabaseClient} from '@supabase/supabase-js';
export const privacyEvent='group-progress-privacy-changed';
export async function getProgressSharing(client:SupabaseClient){
 const {data,error}=await client.rpc('get_group_progress_sharing');if(error)throw error;
 if(typeof data!=='boolean')throw new Error('Privacy preference unavailable');return data;
}
export function publishPrivacyChange(userId:string){
 window.dispatchEvent(new CustomEvent(privacyEvent,{detail:userId}));
 if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(privacyEvent);channel.postMessage(userId);channel.close();}
}
export function subscribePrivacyChange(userId:string,refresh:()=>void){
 const local=(event:Event)=>{if((event as CustomEvent).detail===userId)refresh();};
 window.addEventListener(privacyEvent,local);
 const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(privacyEvent);
 if(channel)channel.onmessage=event=>{if(event.data===userId)refresh();};
 return()=>{window.removeEventListener(privacyEvent,local);channel?.close();};
}
export async function saveProgressSharing(client:SupabaseClient,userId:string,enabled:boolean){
 const {data,error}=await client.rpc('set_group_progress_sharing',{p_enabled:enabled});if(error)throw error;
 if(data!==enabled)throw new Error('Privacy preference was not saved');
 publishPrivacyChange(userId);return enabled;
}
