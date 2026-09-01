import { describe, expect, it } from 'vitest'
import { cardioLoadMessage } from './repository'

describe('Cardio load recovery', () => {
  it('distinguishes schema, session, RLS, network, and unexpected failures', () => {
    expect(cardioLoadMessage({ code: '42P01', message: 'relation does not exist' })).toContain('schema update')
    expect(cardioLoadMessage({ status: 401 })).toContain('expired')
    expect(cardioLoadMessage({ code: '42501' })).toContain('permission')
    expect(cardioLoadMessage({ message: 'Failed to fetch' })).toContain('reach Supabase')
    expect(cardioLoadMessage({ code: 'XX000' })).toContain('unexpected')
  })
})
