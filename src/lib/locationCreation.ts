import type { SupabaseClient } from '@supabase/supabase-js';
import { getLocations, saveLocation, setLocationArchived } from '../features/strength/repository';
export const normalizeLocation=(name:string)=>name.trim().replace(/\s+/g,' ');
export async function findOrCreateLocation(client:SupabaseClient,userId:string,name:string) {
  const normalized=normalizeLocation(name);
  if(!normalized)throw new Error('Enter a location name.');
  const find=async()=> (await getLocations(client,userId)).find(location=>normalizeLocation(location.name).toLocaleLowerCase()===normalized.toLocaleLowerCase());
  const existing=await find();
  if(existing){if(existing.archived)await setLocationArchived(client,userId,existing.id,false);return {id:existing.id,name:existing.name,existing:true};}
  try {return {id:await saveLocation(client,userId,normalized),name:normalized,existing:false};}
  catch(error){const raced=await find();if(raced&&!raced.archived)return{id:raced.id,name:raced.name,existing:true};throw error;}
}
