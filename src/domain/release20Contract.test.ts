import {expect,it} from 'vitest';
import app from '../App.tsx?raw';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');
import cardio from '../features/cardio/DurationWheel.tsx?raw';
import stretch from '../features/flexibility/StretchDurationWheel.tsx?raw';
import migration from '../../supabase/migrations/202609140008_release_announcements.sql?raw';
import worker from '../../public/sw.js?raw';
it('removes placeholder Home cards and retains the inset mobile frame',()=>{
  expect(app).not.toMatch(/THIS WEEK|NEXT MILESTONE|0 entries|floating-add/);expect(app).toContain('app-frame');expect(css).toContain('border-inline:2px');expect(css).toContain('env(safe-area-inset-bottom)');
});
it('uses one light selection band and transparent dark selected numbers',()=>{
  expect(css).toContain('.wheel-option[aria-selected=true]{background:transparent;color:#111');expect(css).not.toMatch(/wheel-option\[aria-selected=true\][^}]*background:#d71920/);
  expect(cardio.match(/key: "(?:hours|minutes|seconds)"/g)).toHaveLength(3);expect(stretch.match(/<WheelColumn/g)).toHaveLength(2);expect(stretch).not.toContain('label={`${label} Hours`}');
});
it('migration only creates private release acknowledgement storage',()=>{
  expect(migration).toContain('enable row level security');expect(migration.match(/auth.uid\(\)\) = user_id/g)).toHaveLength(2);
  expect(migration).toContain('grant select, insert');expect(migration).not.toMatch(/\b(update|delete from|insert into|alter table public\.(profiles|user_settings|weigh_ins|strength_workouts))\b/i);
});
it('never caches auth, API or Supabase requests',()=>{for(const path of ['/rest/','/auth/','/api/','/functions/'])expect(worker).toContain(path);expect(worker).toContain("url.origin !== self.location.origin");expect(worker).toContain("url.hostname.includes('supabase')");});
