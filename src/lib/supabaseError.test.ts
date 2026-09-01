import{describe,expect,it}from'vitest'
import{classifyDataError,dataLoadMessage,relationObject}from'./supabaseError'

describe('Supabase data error classification',()=>{
  it('does not misclassify an ambiguous relationship as a network failure',()=>{const error={code:'PGRST201',message:'Could not embed because more than one relationship was found'};expect(classifyDataError(error,false)).toBe('query');expect(dataLoadMessage('Strength',error,false)).toContain('relationship')})
  it('classifies truly absent schema separately',()=>expect(classifyDataError({code:'42P01',message:'relation does not exist'})).toBe('schema'))
  it('accepts nullable objects and rejects an unexpected array cardinality',()=>{expect(relationObject(null,'test')).toBeNull();expect(()=>relationObject([], 'test')).toThrow('cardinality')})
})
