import {expect,it} from 'vitest';
import migration from '../../../supabase/migrations/202609290012_zero_rep_attempts.sql?raw';
import previous from '../../../supabase/migrations/202609220011_cardio_steps_and_assisted_progression.sql?raw';
it('changes only the known trigger gate and pre-aggregation eligibility, preserving the full privacy and Cardio contract',()=>{
 expect(migration).toMatch(/^BEGIN;$/m);expect(migration).toMatch(/^COMMIT;$/m);
 expect(migration).toContain('new.reps < 0');expect(migration).not.toContain('new.reps < 1');
 expect(migration).toContain("new.reps::text in ('NaN','Infinity','-Infinity')");
 expect(migration).not.toMatch(/alter table|delete from|update public|insert into|disable row level security/i);
 const old=previous.slice(previous.indexOf('create or replace function public.private_group_summary'),previous.indexOf('-- Existing release ledger')).replace(/\r\n/g,'\n');
 const next=migration.slice(migration.indexOf('create or replace function public.private_group_summary'),migration.indexOf('\nCOMMIT;')).replace(/\r\n/g,'\n');
 expect(next.trim()).toBe(old.replace('and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now',"and (set_row.tracking_type='distance' or set_row.reps>0) and workout_row.performed_at>=v_start and workout_row.performed_at<=v_now").replace('set_row.reps is not null','set_row.reps>0').trim());
});
