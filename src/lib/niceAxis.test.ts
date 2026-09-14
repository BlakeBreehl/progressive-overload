import { describe, expect, it } from 'vitest';
import { niceAxis } from './niceAxis';
describe('nice numeric axes',()=>{
  it('uses a useful Bodyweight range and multiples of five',()=>{
    const result=niceAxis([180,195],5);
    expect(result.domain).toEqual([175,200]);
    expect(result.ticks.every(value=>value%5===0)).toBe(true);
  });
  it('expands identical values and ignores invalid numbers',()=>{
    const {domain}=niceAxis([185,185,NaN,Infinity],5);
    expect(domain[0]).toBeLessThan(185);expect(domain[1]).toBeGreaterThan(185);
  });
  it('preserves small changes and negative ranges',()=>{
    expect(niceAxis([.1,.15]).domain[1]).toBeLessThan(1);
    const {domain}=niceAxis([-2,0,3]);expect(domain[0]).toBeLessThan(-2);expect(domain[1]).toBeGreaterThan(3);
  });
  it('keeps rep ticks integral when requested',()=>expect(niceAxis([9,10],1).ticks.every(Number.isInteger)).toBe(true));
});
