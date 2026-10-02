import {it,expect} from 'vitest';
import {stepAxis} from './stepAxis';
import {defaultAxisSettings} from '../../components/ChartControls';
it('keeps step ticks whole, nonnegative, finite and within custom bounds',()=>{for(const values of [[],[1],[10542],[10,100000]]){const axis=stepAxis(values,defaultAxisSettings);expect(axis.ticks.every(tick=>Number.isSafeInteger(tick)&&tick>=0)).toBe(true)}expect(stepAxis([1,2,3],{...defaultAxisSettings,min:'0.5',max:'3.5'}).ticks).toEqual([1,2,3]);});
