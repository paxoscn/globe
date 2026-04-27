import { describe, it, expect } from 'vitest'

describe('Project setup', () => {
  it('vitest runs with jsdom environment', () => {
    expect(typeof document).toBe('object')
    expect(typeof window).toBe('object')
  })

  it('three.js is importable', async () => {
    const THREE = await import('three')
    expect(THREE.Quaternion).toBeDefined()
    expect(THREE.Vector3).toBeDefined()
  })

  it('fast-check is importable', async () => {
    const fc = await import('fast-check')
    expect(fc.assert).toBeDefined()
    expect(fc.property).toBeDefined()
  })
})
