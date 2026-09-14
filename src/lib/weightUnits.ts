export type WeightUnit='lb'|'kg';
export const KG_PER_LB=0.45359237;
export const LB_PER_KG=2.2046226218;
export function convertWeight(value:number,from:WeightUnit,to:WeightUnit){return from===to?value:from==='lb'?value*KG_PER_LB:value*LB_PER_KG;}
/** Comparison grid: one milligram step (0.000001 kg).
 * This absorbs the published factor's reciprocal error, independently of display rounding.
 * Legacy untagged Strength values are pounds; do not infer units from today's preference.
 */
export const comparisonWeight=(value:number,unit:WeightUnit='lb')=>Math.round((unit==='lb'?value*KG_PER_LB:value)*1e6)/1e6;
export const displayWeight=(value:number,from:WeightUnit,to:WeightUnit)=>from===to?String(value):String(Number(convertWeight(value,from,to).toFixed(4)));
export function normalizeReadings<T extends {weight:number;unit:WeightUnit}>(items:T[],unit:WeightUnit):T[]{return items.map(item=>({...item,weight:convertWeight(item.weight,item.unit,unit),unit}));}
