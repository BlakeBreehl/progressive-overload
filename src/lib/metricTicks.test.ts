import {expect,it} from 'vitest';
import {formatMetric,metricAxis} from './metricTicks';
it('formats duration, pace, speed, percent, distance and integral reps',()=>{
  expect(formatMetric(3723,'duration')).toBe('1:02:03');expect(formatMetric(72,'duration')).toBe('1:12');expect(formatMetric(495,'pace')).toBe('8:15');expect(formatMetric(6.666666,'speed')).toBe('6.7');expect(formatMetric(2,'percentage')).toBe('2%');expect(formatMetric(1.234567,'distance')).toBe('1.235');expect(metricAxis([8,9],'reps').ticks.every(Number.isInteger)).toBe(true);expect(metricAxis([180,195],'weight').ticks.every(value=>value%5===0)).toBe(true);
});
