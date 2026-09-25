import {expect,it} from 'vitest';
import announcement from '../components/ReleaseAnnouncement.tsx?raw';
import settings from '../features/settings/SettingsPanel.tsx?raw';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');
import {releaseId} from '../lib/releaseAnnouncement';
import {bestSet} from '../features/progress/logic';
it('uses a new launch identity and allows intentional manual reopening with idempotent acknowledgement',()=>{
 expect(releaseId).toBe('progressive-overload-2.1-launch');expect(settings).toContain('open-release-announcement');expect(announcement).toContain("await acknowledgeRelease(client,userId)");expect(announcement).toContain('View Leaderboards');expect(announcement).toContain('Explore 2.1');
});
it('waits behind other dialogs and respects reduced motion',()=>{
 expect(announcement).toContain('MutationObserver');expect(announcement).toContain('[role="dialog"],[role="alertdialog"]');expect(css).toContain('@media(prefers-reduced-motion:reduce){.release-hero{animation:none}}');
});
it('uses canonical weight for best-set ties regardless of displayed conversion noise',()=>{
 const lower={date:'2026-09-14',weight:220.46226218,comparisonWeight:100,reps:5};const higher={date:'2026-09-14',weight:220.46226217,comparisonWeight:100,reps:6};expect(bestSet([lower,higher])).toBe(higher);
});
