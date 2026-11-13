import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {DropSetsReleaseContent} from './DropSetsAnnouncement';
import {dropSetsReleaseId} from '../lib/dropSetsRelease';

it('explains supported logging, nested controls, PR inclusion and one main-group set count',()=>{
  const html=renderToStaticMarkup(<DropSetsReleaseContent/>);
  for(const copy of ['Drop Sets Have Arrived','Add Drop Set','Main Set','one or more lighter follow-up','History','PR analysis','one set','muscle-group statistics'])expect(html).toContain(copy);
  expect(dropSetsReleaseId).toBe('progressive-overload-2.4-drop-sets');
  const component=readFileSync('src/components/DropSetsAnnouncement.tsx','utf8');
  expect(component).toContain('title="Progressive Overload 2.4"');
  expect(component).toContain('confirmLabel="Got It — Let’s Lift"');
  expect(component).toContain('singleAction');
  expect(component.indexOf('dropSetsRelease.dismissLocally(userId)')).toBeLessThan(component.lastIndexOf('dropSetsRelease.reconcile(client,userId)'));
});
it('only mounts the current announcement after authenticated account readiness and setup',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  expect(app).toContain('ready={!auth.loading&&loadedUserId===auth.session.user.id&&!setupError}');
  expect(app.indexOf('if (setupError)')).toBeLessThan(app.indexOf('<DropSetsAnnouncement'));
  expect(app.indexOf('if (!onboarded)')).toBeLessThan(app.indexOf('<DropSetsAnnouncement'));
  expect(app).not.toContain('<StrengthTrendsAnnouncement');
});
