export const stretchDurationParts=(seconds:number)=>({minutes:Math.floor(seconds/60),seconds:seconds%60})
export const stretchDurationSeconds=(minutes:number,seconds:number)=>minutes*60+seconds
export const validStretchDuration=(seconds:number)=>Number.isInteger(seconds)&&seconds>=1&&seconds<=5999
