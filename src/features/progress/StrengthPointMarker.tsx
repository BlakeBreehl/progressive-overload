import type {strengthModePoints} from './strengthModes';
export type StrengthChartPoint=ReturnType<typeof strengthModePoints>[number];
const pointDescription=(point:StrengthChartPoint,unit:string)=>point.date+' \u00b7 '+point.exercise+' \u00b7 '+point.displayValue+' '+(point.displayUnit??unit)+(point.repsOnly||point.reps===null?'':' \u00b7 '+point.reps+' reps')+' \u00b7 '+point.location;
export function StrengthPointMarker({cx,cy,payload,unit,onActivate}:{cx?:number;cy?:number;payload?:StrengthChartPoint;unit:string;onActivate:(id:string)=>void}){
 if(cx==null||cy==null||!payload)return null;
 const activate=()=>onActivate(payload.id);
 return <circle className="strength-set-marker" data-set-id={payload.id} cx={cx} cy={cy} r={3.5} fill="#d71920" stroke="#fff" strokeWidth={1} role="button" tabIndex={0} aria-label={pointDescription(payload,unit)} onFocus={activate} onMouseEnter={activate} onMouseMove={activate} onClick={activate} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}}}/>;
}
