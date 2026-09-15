export type ExerciseSort='sets'|'alphabetical';
export const defaultExerciseSort:ExerciseSort='sets';
export const normalizedExerciseName=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase();
type SetPoint={id?:string;exerciseId:string;date:string;locationId:string;source:string;periodLabel:string};
export function exerciseTableRows<T extends SetPoint>(exercises:Array<[string,string]>,points:T[],options:{periods:string[];yearly?:boolean;search?:string;sort?:ExerciseSort;page?:number;pageSize?:number}){
 const query=normalizedExerciseName(options.search??'');
 const filtered=exercises.filter(([,name])=>normalizedExerciseName(name).includes(query));
 const periodSet=new Set(options.periods),eligible=points.filter(point=>periodSet.has(point.periodLabel.slice(0,options.yearly?4:7))&&(options.yearly||point.source!=='yearly'));
 const counts=new Map<string,number>(),seen=new Set<string>();
 for(const point of eligible){if(point.source!=='dated')continue;if(point.id&&seen.has(point.id))continue;if(point.id)seen.add(point.id);counts.set(point.exerciseId,(counts.get(point.exerciseId)??0)+1);}
 const sorted=filtered.map(([id,name])=>({id,name,count:counts.get(id)??0})).sort((a,b)=>((options.sort??defaultExerciseSort)==='sets'?b.count-a.count:0)||normalizedExerciseName(a.name).localeCompare(normalizedExerciseName(b.name))||a.id.localeCompare(b.id));
 const size=options.pageSize??20,total=sorted.length,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(pages,Math.max(1,options.page??1)),offset=(page-1)*size;
 return {items:sorted.slice(offset,offset+size),points:eligible,total,pages,page,start:total?offset+1:0,end:Math.min(total,offset+size)};
}
