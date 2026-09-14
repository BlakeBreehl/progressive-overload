import { describe, expect, it } from 'vitest'
import app from '../App.tsx?raw'
import strength from '../features/strength/StrengthFeature.tsx?raw'
import cardio from '../features/cardio/CardioFeature.tsx?raw'
import flexibility from '../features/flexibility/FlexibilityFeature.tsx?raw'
import weight from '../features/weight/WeightFeature.tsx?raw'
const compact=(source:string)=>source.replace(/\s+/g,'').replace(/"/g,"'")

describe('create-entry rendering contract', () => {
  it.each([
    ['strength', strength, 'Add Strength Workout'],
    ['cardio', cardio, 'Add Cardio Entry'],
    ['flexibility', flexibility, 'Add Stretch Entry'],
    ['weight', weight, 'Add Bodyweight Entry'],
  ])('%s supports a persistent create prop and renders its real form', (_module, source, heading) => {
    source=compact(source);expect(source).toContain('create=false')
    expect(source).toContain(heading.replace(/\s+/g,''))
    expect(source).toContain('onExitCreate(false)')
  })

  it('uses creation routes for contextual and Home chooser actions', () => {
    const source=compact(app);expect(source).toContain('createPath(next.screenasModuleKey)')
    expect(source).toContain("navigate({screen:key,creating:true")
    expect(source).toContain('pick={triggerAdd}')
  })

  it('uses the dedicated Home logging treatment', () => {
    expect(app).toContain('home-log-button mt-6')
    expect(app).not.toContain('rounded-xl bg-ink px-5')
  })
})
