const meters:Record<string,number>={meters:1,m:1,kilometers:1000,km:1000,miles:1609.344,mi:1609.344,yards:.9144,feet:.3048};
/** Unknown units and absent measurements are not zero-distance entries. */
export function distanceMiles(value:number|null|undefined,unit:string|null|undefined):number|null{
  const factor=meters[unit??''];
  return value==null||!Number.isFinite(value)||value<0||!factor?null:value*factor/1609.344;
}
export function convertDistance(value:number,unit:string,target='miles'){
  const miles=distanceMiles(value,unit),factor=meters[target];
  return miles===null||!factor?NaN:miles*1609.344/factor;
}
export const displayMiles=(value:number)=>`${Number(value.toFixed(3))} mi`;
