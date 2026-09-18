import {describe,expect,it} from 'vitest';
import {convertDistance,distanceMiles,displayMiles} from './distanceUnits';
import {aggregateCardio} from '../features/progress/logic';
describe('distance normalization without storage changes',()=>{
 it.each([[1,'miles',1],[1.609344,'kilometers',1],[1609.344,'meters',1],[.25,'mi',.25],[0,'km',0]])('converts %s %s', (value,unit,expected)=>expect(distanceMiles(value as number,unit as string)).toBeCloseTo(expected as number,12));
 it.each([[null,'miles'],[undefined,'km'],[10,'laps'],[1,null],[NaN,'miles'],[-1,'miles']])('excludes incompatible %s %s',(value,unit)=>expect(distanceMiles(value as number,unit as string)).toBeNull());
 it('aggregates mixed decimal units before display rounding',()=>{const inputs=[{date:'2026-09-01',duration:60,distance:distanceMiles(.123456,'miles')!},{date:'2026-09-02',duration:60,distance:distanceMiles(1,'kilometers')!}];const total=aggregateCardio(inputs,'month')[0].distance;expect(total).toBeCloseTo(.123456+1/1.609344,12);expect(displayMiles(total)).toBe('0.745 mi');expect(inputs[0].distance).toBe(.123456);expect(convertDistance(1,'miles','meters')).toBe(1609.344);});
});
