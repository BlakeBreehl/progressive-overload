import{describe,expect,it}from'vitest'
import{classifyDataError,dataLoadMessage,relationObject}from'./supabaseError'

describe('Supabase data error classification',()=>{
  it('does not misclassify an ambiguous relationship as a network failure',()=>{const error={code:'PGRST201',message:'Could not embed because more than one relationship was found'};expect(classifyDataError(error,false)).toBe('query');expect(dataLoadMessage('Strength',error,false)).toContain('relationship')})
  it('classifies truly absent schema separately',()=>expect(classifyDataError({code:'42P01',message:'relation does not exist'})).toBe('schema'))
  it('accepts nullable objects and rejects an unexpected array cardinality',()=>{expect(relationObject(null,'test')).toBeNull();expect(()=>relationObject([], 'test')).toThrow('cardinality')})
})

it('diagnostics omit arbitrary raw messages, details and hints',async()=>{const {safeSupabaseDiagnostic}=await import('./supabaseError');const {vi}=await import('vitest');const spy=vi.spyOn(console,'error').mockImplementation(()=>{});safeSupabaseDiagnostic('Startup','load profiles',{code:'42501',status:403,message:'fixture-private@example.invalid',details:'fixture-secret',hint:'fixture-reset-link'});const output=JSON.stringify(spy.mock.calls);expect(output).toContain('42501');expect(output).not.toMatch(/fixture-private|fixture-secret|fixture-reset-link|details|hint/);spy.mockRestore();});

it('recognizes Safari Load failed without retrying permanent schema errors',async()=>{const {transientDataError}=await import('./supabaseError');expect(transientDataError(new TypeError('Load failed'))).toBe(true);expect(transientDataError({message:'TypeError: Load failed'})).toBe(true);expect(transientDataError({code:'42703',message:'Load failed',status:503})).toBe(false);});
