import {expect,it} from 'vitest';
import { bodyweightChart,defaultLineStyle,lineType } from './chart';
import source from './WeightFeature.tsx?raw';
it('connects independent real readings across gaps without inserting measurements',()=>{
  const data=[{id:'a',measuredAt:'2026-01-01T08:00:00',period:'morning' as const,weight:185.125,unit:'lb' as const},{id:'b',measuredAt:'2026-01-03T20:00:00',period:'evening' as const,weight:186,unit:'lb' as const},{id:'c',measuredAt:'2026-01-08T08:00:00',period:'morning' as const,weight:184,unit:'lb' as const}];
  const before=structuredClone(data),points=bodyweightChart(data);
  expect(points).toHaveLength(3);expect(points.map(p=>p.morning)).toEqual([185.125,null,184]);expect(points.map(p=>p.evening)).toEqual([null,186,null]);
  expect(source.match(/connectNulls\s+type=\{lineType\(style\)\}/g)).toHaveLength(2);
  expect(defaultLineStyle).toBe('straight');expect(lineType('straight')).toBe('linear');expect(lineType('smooth')).toBe('monotone');
  expect(bodyweightChart(data)).toEqual(points);expect(data).toEqual(before);
});
