import { describe, expect, it } from 'vitest'
import { createNpmPlugin, NpmPluginSystem } from '../src/index'

describe('plugin-system', () => {
  describe('createNpmPlugin', () => {
    it('should create a plugin system instance', () => {
      const plugins = createNpmPlugin('test-app')

      expect(plugins).toBeDefined()
      expect(plugins).toBeInstanceOf(NpmPluginSystem)
      expect(typeof plugins.search).toBe('function')
      expect(typeof plugins.install).toBe('function')
      expect(typeof plugins.uninstall).toBe('function')
      expect(typeof plugins.list).toBe('function')
      expect(typeof plugins.update).toBe('function')
      expect(typeof plugins.load).toBe('function')
    })

    it('should throw error for invalid plugin ID', () => {
      expect(() => createNpmPlugin('Invalid-ID')).toThrow('Invalid plugin ID')
    })

    it('should accept custom options', () => {
      const plugins = createNpmPlugin('test-app', {
        pluginDir: '/custom/path',
        registry: 'https://custom-registry.com'
      })

      expect(plugins).toBeDefined()
      expect(plugins).toBeInstanceOf(NpmPluginSystem)
    })
  })

  describe('npmPluginSystem', () => {
    it('should create instance directly', () => {
      const system = new NpmPluginSystem('test-direct')

      expect(system).toBeDefined()
      expect(system).toBeInstanceOf(NpmPluginSystem)
      expect(typeof system.search).toBe('function')
      expect(typeof system.install).toBe('function')
      expect(typeof system.uninstall).toBe('function')
      expect(typeof system.list).toBe('function')
      expect(typeof system.update).toBe('function')
      expect(typeof system.load).toBe('function')
    })

    it('should throw error for invalid plugin ID when created directly', () => {
      expect(() => new NpmPluginSystem('Invalid-ID')).toThrow('Invalid plugin ID')
    })
  })
})
