import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {WeeklyChangeTable} from './WeeklyChangeTable';
import feature from './WeightFeature.tsx?raw';
import announcement from '../../components/ReleaseAnnouncement.tsx?raw';
import {releaseId} from '../../lib/releaseAnnouncement';
it('renders accessible neutral weekly rows, separate pagination and readable scroll columns',()=>{const html=renderToStaticMarkup(<WeeklyChangeTable readings={[{id:'a',measuredAt:new Date().toISOString(),weight:100,unit:'lb',period:'morning'}]} unit="lb" period="both"/>);for(const text of ['<caption','scope="col"','scope="row"','overflow-x-auto','min-w-[560px]','Weekly Bodyweight pages','Previous','Next','Partial','100.0'])expect(html).toContain(text);expect(html).not.toMatch(/NaN|Infinity|undefined|pr-weight|pr-reps|text-green|text-rose/);});
it('keeps the reading chart and summary cards while replacing both change charts',()=>{expect(feature.match(/<LineChart/g)).toHaveLength(1);expect(feature.match(/connectNulls/g)).toHaveLength(2);expect(feature).toContain('Line Style');expect(feature).toContain('weeklyComparison(axisVisible)');expect(feature).toContain('monthlyComparison(axisVisible)');expect(feature).toContain('getWeightHistoryPage');expect(feature).toContain('saveWeighIn');expect(feature).toContain('deleteWeighIn');expect(feature).toContain('<WeeklyChangeTable');});
it('keeps the new release independent of the original acknowledgement',()=>{expect(releaseId).toBe('progressive-overload-2.1-launch');expect(announcement).toContain('Progressive Overload 2.1');});
