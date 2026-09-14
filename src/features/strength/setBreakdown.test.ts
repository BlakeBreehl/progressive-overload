import {expect,it} from 'vitest';
import {countSetGroups,setPeriodStart} from './setBreakdown';
it('uses local calendar month boundaries for each period',()=>{
  const now=new Date(2026,8,14,15);
  for(const months of [1,3,6,12]){const start=setPeriodStart(months,now);expect(start.getDate()).toBe(1);expect(start.getHours()).toBe(0);expect(start.getTime()).toBe(new Date(2026,8-(months-1),1).getTime());}
});
it('counts each actual set once in its primary group with exact totals',()=>{
  const rows=[{id:'a',exercise:{major_muscle_group:'Chest',is_compound:true}},{id:'b',exercise:{major_muscle_group:'Chest'}},{id:'c',exercise:{major_muscle_group:'Olympic Lifts'}},{id:'a',exercise:{major_muscle_group:'Back'}}];
  const result=countSetGroups(rows);expect(result.total).toBe(3);expect(result.groups.reduce((sum,g)=>sum+g.value,0)).toBe(3);expect(result.groups.find(g=>g.name==='Chest')?.value).toBe(2);expect(result.groups.find(g=>g.name==='Olympic/Other')?.value).toBe(1);
});
