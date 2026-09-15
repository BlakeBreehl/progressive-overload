import {expect,it} from 'vitest';
import {mobileDestinations,secondaryDestinations} from './groupNavigation';
import {parseAppRoute,screenPath} from './routing';
import app from '../App.tsx?raw';
it('keeps Leaderboards and Progress directly visible in every module combination',()=>{
 for(let mask=0;mask<16;mask++){
  const enabled={strength:!!(mask&1),cardio:!!(mask&2),flexibility:!!(mask&4),weight:!!(mask&8)},primary=mobileDestinations(enabled),secondary=secondaryDestinations(enabled);
  expect(primary.length).toBeLessThanOrEqual(5);expect(primary.map(item=>item.key)).toEqual(['home',...(enabled.strength?['strength']:[]),'progress','leaderboards',...(secondary.length?['more']:[])]);
  expect(secondary.map(item=>item.key)).toEqual([...(enabled.cardio?['cardio']:[]),...(enabled.flexibility?['flexibility']:[]),...(enabled.weight?['weight']:[])]);
 }
});
it('supports direct routes and reversible browser history paths',()=>{for(const route of ['leaderboards','cardio','progress','settings'] as const)expect(parseAppRoute(screenPath(route))).toEqual({screen:route,creating:false});expect(parseAppRoute('/strength/new')).toEqual({screen:'strength',creating:true});});
it('keeps Home as the canonical Settings entry, outside primary navigation',()=>{
 expect(app).toContain('aria-label="Open Settings"');expect(app).toContain('onClick={settings}');expect(app).toContain('settings={() => go("settings")}');
 expect(app.slice(app.indexOf('const nav = useMemo'),app.indexOf('[enabled]',app.indexOf('const nav = useMemo')))).not.toContain('settings');
 expect(app.slice(app.indexOf('<header className="mobile-header">'),app.indexOf('</header>',app.indexOf('<header className="mobile-header">')))).not.toContain('settings');
});
