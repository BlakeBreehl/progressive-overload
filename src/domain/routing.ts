import type { ModuleKey } from './modules'

export type AppScreen = 'home' | ModuleKey | 'progress' | 'settings'
export type AppRoute = { screen: AppScreen; creating: boolean }

const moduleKeys: ModuleKey[] = ['strength', 'cardio', 'flexibility', 'weight']

export function parseAppRoute(pathname: string): AppRoute {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  const first = parts[0] || 'home'
  if (moduleKeys.includes(first as ModuleKey)) return { screen: first as ModuleKey, creating: parts[1] === 'new' }
  if (first === 'progress' || first === 'settings') return { screen: first, creating: false }
  return { screen: 'home', creating: false }
}

export const screenPath = (screen: AppScreen) => screen === 'home' ? '/' : `/${screen}`
export const createPath = (module: ModuleKey) => `/${module}/new`
