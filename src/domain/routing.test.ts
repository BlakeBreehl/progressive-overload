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
