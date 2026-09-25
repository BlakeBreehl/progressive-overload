export const durationToSeconds=(hours:number,minutes:number,seconds:number)=>hours*3600+minutes*60+seconds
export const durationParts=(value:number)=>({hours:Math.floor(value/3600),minutes:Math.floor(value%3600/60),seconds:value%60})
export const formatTimerDuration=(value:number)=>{const{hours,minutes,seconds}=durationParts(value);return[hours,minutes,seconds].map(x=>String(x).padStart(2,'0')).join(':')}
export const formatDuration=(value:number)=>{const h=Math.floor(value/3600),m=Math.floor(value%3600/60),s=value%60;return[h?`${h}h`:null,m?`${m}m`:null,s||(!h&&!m)?`${s}s`:null].filter(Boolean).join(' ')}
export function validateCardio(input:{activityName:string;hours:number;minutes:number;seconds:number;distance?:number;speed?:number;incline?:number;difficulty?:number}){const errors:string[]=[];if(!input.activityName)errors.push('Choose an activity.');if(!Number.isInteger(input.hours)||input.hours<0||input.hours>99||!Number.isInteger(input.minutes)||input.minutes<0||input.minutes>59||!Number.isInteger(input.seconds)||input.seconds<0||input.seconds>59||durationToSeconds(input.hours,input.minutes,input.seconds)<1)errors.push('Enter at least one second, from 00:00:01 through 99:59:59.');for(const[key,value]of Object.entries({distance:input.distance,speed:input.speed,incline:input.incline}))if(value!==undefined&&(!Number.isFinite(value)||value<0))errors.push(`${key} cannot be negative.`);if(input.difficulty!==undefined&&(!Number.isFinite(input.difficulty)||input.difficulty<0||input.difficulty>10))errors.push('Difficulty must be between 0 and 10.');return errors}
export const cardioFields=(name:string)=>({distance:['Running','Treadmill',"Jacob's Ladder",'Spin Bike'].includes(name),speed:['Running','Treadmill'].includes(name),incline:name==='Treadmill',difficulty:['StairMaster',"Jacob's Ladder",'Spin Bike'].includes(name)})

/** Keep raw text until submission; PostgreSQL integer range is the storage contract. */
export function parseStepCount(value:string):number|null{
 if(value==='')return null;
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>2147483647)throw new Error('Steps must be a whole number from 1 to 2,147,483,647.');
 return Number(value);
}
