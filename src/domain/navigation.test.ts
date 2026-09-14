import { describe, expect, it } from 'vitest'
import { primaryNavigation } from './modules'

describe('primary navigation and Add behavior', () => {
  const enabled = { strength: true, cardio: false, flexibility: true, weight: false }

  it('shows enabled modules and Progress, never Settings', () => {
    expect(primaryNavigation(enabled)).toEqual(['home', 'strength', 'flexibility', 'progress'])
    expect(primaryNavigation(enabled)).not.toContain('settings')
  })

  it('keeps Home and Progress for all 16 enabled-module combinations',()=>{
    for(let mask=0;mask<16;mask++){
      const nav=primaryNavigation({strength:!!(mask&1),cardio:!!(mask&2),flexibility:!!(mask&4),weight:!!(mask&8)});
      expect(nav[0]).toBe('home');expect(nav.at(-1)).toBe('progress');
      expect(nav.length).toBeLessThanOrEqual(6);expect(new Set(nav).size).toBe(nav.length);
    }
  });

})
