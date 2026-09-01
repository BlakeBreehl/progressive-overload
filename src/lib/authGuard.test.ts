import { describe, expect, it } from 'vitest'
import { resolveAuthView } from './authGuard'

describe('authentication guard', () => {
  it('requires configuration before exposing authentication', () => expect(resolveAuthView(false, false, false)).toBe('configuration'))
  it('does not render protected content while loading', () => expect(resolveAuthView(true, true, true)).toBe('loading'))
  it('sends anonymous users to authentication', () => expect(resolveAuthView(true, false, false)).toBe('authentication'))
  it('allows a resolved authenticated session', () => expect(resolveAuthView(true, false, true)).toBe('application'))
})
