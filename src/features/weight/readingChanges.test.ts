import { expect, it } from 'vitest';
import { readingChanges } from './readingChanges';
import type { Reading } from './logic';
it('compares only the same period and unit exactly one local week earlier',()=>{
  const reading=(id:string,measuredAt:string,weight:number,overrides:Partial<Reading>={}):Reading=>({id,measuredAt,weight,period:'morning',unit:'lb',...overrides});
  const result=readingChanges([
    reading('prior','2026-01-01T12:00:00',180),
    reading('other','2026-01-01T18:00:00',200,{period:'evening'}),
    reading('now','2026-01-08T12:00:00',181.25),
    reading('kg','2026-01-08T12:00:00',80,{unit:'kg'}),
    reading('gap','2026-02-08T12:00:00',182),
  ]);
  expect(result.get('now')?.absolute).toBe(1.25);
  expect(result.get('kg')).toBeNull();expect(result.get('gap')).toBeNull();expect(result.get('prior')).toBeNull();
});
