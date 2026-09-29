import { describe, expect, it } from 'vitest'
import { createPath, parseAppRoute, screenPath } from './routing'

describe('entry routes', () => {
  it.each(['strength','cardio','flexibility','weight'] as const)('%s /new survives refresh parsing', module => {
    expect(createPath(module)).toBe(`/${module}/new`)
    expect(parseAppRoute(`/${module}/new`)).toEqual({ screen: module, creating: true })
  })

  it('keeps normal module navigation distinct from creation', () => {
    expect(parseAppRoute('/cardio')).toEqual({ screen: 'cardio', creating: false })
    expect(screenPath('progress')).toBe('/progress')
    expect(parseAppRoute('/progress').creating).toBe(false)
  })
})

it('returns every nested module path to its canonical landing, retaining the legacy Groups alias',()=>{
 for(const screen of ['home','strength','cardio','flexibility','weight','progress','leaderboards'] as const){
  const home=screenPath(screen);
  for(const sub of ['new','edit/id','detail/id','history','success','manage'])expect(parseAppRoute(home+'/'+sub).screen).toBe(screen);
 }
 expect(screenPath('leaderboards')).toBe('/groups');
 expect(parseAppRoute('/leaderboards/detail')).toEqual({screen:'leaderboards',creating:false});
});
