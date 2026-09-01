import { describe, expect, it } from 'vitest'
import sql from '../../../supabase/migrations/202608300004_activity_modules.sql?raw'

describe('activity migration contract', () => {
  it('installs private Cardio activities and Flexibility ownership policies', () => {
    for (const name of ['Running', 'Treadmill', 'StairMaster', "Jacob''s Ladder", 'Spin Bike']) expect(sql).toContain(name)
    expect(sql).toContain('mobility_activity_area_assignments')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('auth.uid()')
  })

  it('is resumable after every object created before the reported failure', () => {
    expect(sql).toContain('create table if not exists public.cardio_library_installations')
    expect(sql).toContain("policyname='cardio_library_installations_select_own'")
    expect(sql).toContain("c.conname='mobility_activities_id_user_unique'")
    expect(sql.indexOf("c.conname='mobility_activities_id_user_unique'")).toBeLessThan(sql.indexOf('alter table public.mobility_activities add constraint mobility_activities_id_user_unique'))
    expect(sql).toContain('add column if not exists set_count')
    expect(sql).toContain("tgname='on_auth_user_seed_private_cardio_library'")
  })

  it('does not let an existing installation marker suppress starter repair', () => {
    expect(sql).not.toMatch(/if exists\(select 1 from public\.cardio_library_installations[^;]+then return/i)
    expect(sql).toContain('on conflict(user_id) do update')
    expect(sql).toContain('lower(trim(name))=lower(trim(v_name))')
    expect(sql).toContain('for v_user_id in select id from auth.users')
  })
})
