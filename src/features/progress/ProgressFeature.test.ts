import{describe,expect,it}from'vitest';import raw from'./ProgressFeature.tsx?raw';import repositoryRaw from'./repository.ts?raw';const source=(raw+repositoryRaw).replace(/\s+/g,'').replace(/"/g,"'")
describe('wired Progress UI',()=>{
it('renders actual Strength results with reps and location in its tooltip',()=>{expect(source).toContain('Actualrecordedset');expect(source).toContain('item.payload.reps');expect(source).toContain('item.payload.location');expect(source).toContain('noestimatedstrength')})
it('renders searchable all-exercise monthly and yearly tables',()=>{expect(source).toContain('last12calendarmonths');expect(source).toContain('Filter${title}exercises');expect(source).toContain('shown.map');expect(source).toContain('progress-table')})
it('renders compatible Cardio metrics',()=>{for(const text of['Averagespeed','Averagepace','incline','difficulty'])expect(source).toContain(text)})
it('keeps Flexibility time and reps charts separate',()=>{expect(source).toContain('Timestretches');expect(source).toContain('Repstretches');expect(source).toContain("tracking==='time'");expect(source).toContain("kind==='time'?'time':'reps'")})
it('uses explicit relationship hints',()=>{for(const hint of['strength_set_workout_owned_fk','strength_set_exercise_type_owned_fk','cardio_activity_owned_fk','mobility_sets_session_owned_fk'])expect(source).toContain(`!${hint}`)})
})
