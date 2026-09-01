import { describe, expect, it } from 'vitest'
import manifest from '../../public/manifest.webmanifest?raw'
import app from '../App.tsx?raw'

describe('visual and terminology contract', () => {
  it('uses the red, white, and black visual system', () => {
    expect(app).toContain('#d71920')
    expect(app).toContain('#111111')
    expect(app).not.toMatch(/#080d14|#b9ff35/i)
    expect(manifest).toContain('#ffffff')
  })

  it('keeps user-facing module terminology on Flexibility', () => {
    expect(app).toContain('Flexibility')
    expect(app).not.toMatch(/Mobility/)
  })
})
