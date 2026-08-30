export type AuthView = 'loading' | 'configuration' | 'authentication' | 'application'
export function resolveAuthView(configured: boolean, loading: boolean, hasSession: boolean): AuthView {
  if (!configured) return 'configuration'
  if (loading) return 'loading'
  return hasSession ? 'application' : 'authentication'
}
