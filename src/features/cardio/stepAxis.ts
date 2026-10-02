import {niceAxis} from '../../lib/niceAxis';
import {axisError,type AxisSettings} from '../../components/ChartControls';
/** Integer tick positions, including when users choose fractional custom bounds. */
export function stepAxis(values:number[],settings:AxisSettings){
 const automatic=niceAxis(values,1);
 const valid=!axisError(settings);
 const low=Math.max(0,valid&&settings.min!==''?Number(settings.min):automatic.domain[0]);
 const high=Math.max(low+1,valid&&settings.max!==''?Number(settings.max):automatic.domain[1]);
 return {domain:[low,high] as [number,number],ticks:niceAxis([low,high],1).ticks.filter(value=>Number.isInteger(value)&&value>=low&&value<=high)};
}
