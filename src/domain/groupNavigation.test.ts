import {expect,it} from 'vitest';
import {mobileDestinations,secondaryDestinations} from './groupNavigation';
import {parseAppRoute,screenPath} from './routing';
it('keeps Leaderboards and Progress directly visible in every module combination',()=>{
 for(let mask=0;mask<16;mask++){
  const enabled={strength:!!(mask&1),cardio:!!(mask&2),flexibility:!!(mask&4),weight:!!(mask&8)},primary=mobileDestinations(enabled),secondary=secondaryDestinations(enabled);
  expect(primary.length).toBeLessThanOrEqual(5);expect(primary.map(item=>item.key)).toEqual(['home',...(enabled.strength?['strength']:[]),'progress','leaderboards','more']);
  expect(secondary.map(item=>item.key)).toEqual([...(enabled.cardio?['cardio']:[]),...(enabled.flexibility?['flexibility']:[]),...(enabled.weight?['weight']:[]),'settings']);
 }
});
it('supports direct routes and reversible browser history paths',()=>{for(const route of ['leaderboards','cardio','progress','settings'] as const)expect(parseAppRoute(screenPath(route))).toEqual({screen:route,creating:false});expect(parseAppRoute('/strength/new')).toEqual({screen:'strength',creating:true});});
