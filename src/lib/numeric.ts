export function parseWhole(value:string|number,label:string,{allowZero=false,optional=false}:{allowZero?:boolean;optional?:boolean}={}){
  if(value===""&&optional)return undefined;
  const text=String(value);
  if(!/^\d+$/.test(text))throw new Error(`${label} must be a whole number.`);
  const parsed=Number(text),minimum=allowZero?0:1;
  if(!Number.isSafeInteger(parsed)||parsed<minimum)throw new Error(`${label} must be ${allowZero?"zero or more":"a positive whole number"}.`);
  return parsed;
}
export function parseDecimal(value:string|number,label:string,{allowZero=false,optional=false}:{allowZero?:boolean;optional?:boolean}={}){
  if(value===""&&optional)return undefined;
  const text=String(value);
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))throw new Error(`${label} must be a valid number.`);
  const parsed=Number(text),minimum=allowZero?0:Number.MIN_VALUE;
  if(!Number.isFinite(parsed)||parsed<minimum)throw new Error(`${label} must be ${allowZero?"zero or more":"greater than zero"}.`);
  return parsed;
}
