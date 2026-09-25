import {startupTrace} from './startupDiagnostic';
import {safeSupabaseDiagnostic} from './supabaseError';
import {lazy,type ComponentType,type ComponentProps,createElement} from 'react';
const retryLoaders=new Set<()=>void>();
export function resetFailedFeatures(){for(const retry of retryLoaders)retry();}
/** React caches rejected lazy promises. Reset only failed loaders on explicit Retry. */
export function retryableLazy<T extends ComponentType<any>>(load:()=>Promise<{default:T}>){
 let failed=false;
 const attempt=()=>{startupTrace('Features','import module');return load().then(module=>{startupTrace('Features','import module','ready');return module;}).catch(error=>{safeSupabaseDiagnostic('Features','import module',error);failed=true;throw error;});};
 let Feature=lazy(attempt);
 retryLoaders.add(()=>{if(failed){failed=false;Feature=lazy(attempt);}});
 return function RetryableFeature(props:ComponentProps<T>){return createElement(Feature,props);};
}
