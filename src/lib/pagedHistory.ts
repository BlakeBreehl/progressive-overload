export type HistoryFilters = { page:number; pageSize?:number; search?:string; activityId?:string; exerciseId?:string; locationId?:string; noLocation?:boolean; start?:string; end?:string; bodyArea?:string; trackingType?:string; period?:string };
export type HistoryPage<T> = { items:T[]; total:number };
export const historyRange=(page:number,pageSize=20)=>({from:(Math.max(1,page)-1)*pageSize,to:Math.max(1,page)*pageSize-1});
export const validHistoryPage=(total:number,pageSize=20)=>Math.max(1,Math.ceil(total/pageSize));
export const searchPattern=(value='')=>`%${value.trim().replace(/\s+/g,'%')}%`;
