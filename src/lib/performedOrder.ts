export const performedTimestamp=(value:string)=>new Date(value.length===10?`${value}T00:00:00`:value).getTime();
/** Date-only values are local calendar days, never UTC midnight. */
export function orderPerformed<T extends {performed_at:string;created_at?:string;id:string}>(rows:T[]):T[]{
 return [...rows].filter(row=>Number.isFinite(performedTimestamp(row.performed_at))).sort((a,b)=>performedTimestamp(a.performed_at)-performedTimestamp(b.performed_at)||(performedTimestamp(a.created_at??a.performed_at)-performedTimestamp(b.created_at??b.performed_at)||0)||a.id.localeCompare(b.id));
}
