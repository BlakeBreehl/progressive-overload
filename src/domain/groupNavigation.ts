import type { ModuleState } from './modules';
import type { AppScreen } from './routing';
type Destination={key:AppScreen|'more';label:string;icon:string};
export function mobileDestinations(enabled:ModuleState):Destination[]{return [{key:'home',label:'Home',icon:'home'},...(enabled.strength?[{key:'strength' as const,label:'Strength',icon:'dumbbell'}]:[]),{key:'progress',label:'Progress',icon:'chart'},{key:'leaderboards',label:'Leaderboards',icon:'trophy'},{key:'more',label:'More',icon:'settings'}];}
export function secondaryDestinations(enabled:ModuleState):Array<Destination&{key:AppScreen}>{return [...(enabled.cardio?[{key:'cardio' as const,label:'Cardio',icon:'pulse'}]:[]),...(enabled.flexibility?[{key:'flexibility' as const,label:'Flexibility',icon:'spark'}]:[]),...(enabled.weight?[{key:'weight' as const,label:'Bodyweight',icon:'scale'}]:[]),{key:'settings',label:'Settings',icon:'settings'}];}
