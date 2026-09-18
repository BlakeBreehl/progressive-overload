import type {SupabaseClient} from '@supabase/supabase-js';
import {loadUserSetupWithRetry,type UserSetup} from './settings';
export type AccountBootstrapState={userId:string;setup?:UserSetup;error?:unknown};
/** Each subscriber owns publication lifetime; StrictMode shares only the request. */
export function startAccountBootstrap(client:SupabaseClient,userId:string,publish:(state:AccountBootstrapState)=>void){
 let active=true;
 void loadUserSetupWithRetry(client,userId).then(setup=>{if(active)publish({userId,setup});},error=>{if(active)publish({userId,error});});
 return()=>{active=false;};
}
