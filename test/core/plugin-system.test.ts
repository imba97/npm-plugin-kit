import { describe, expect, it, vi } from 'vitest'
import { createNpmPlugin, NpmPluginSystem } from '../../src/index'

describe('plugin-system', () => {
  describe('createNpmPlugin', () => {
    it('should create a plugin system instance', () => {
      const plugins = createNpmPlugin('test-app')

      expect(plugins).toBeDefined()
      expect(plugins).toBeInstanceOf(NpmPluginSystem)
      expect(typeof plugins.search).toBe('function')
      expect(typeof plugins.view).toBe('function')
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
        registry: 'https://custom-registry.com',
        cacheFields: ['homepage']
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
      expect(typeof system.view).toBe('function')
      expect(typeof system.install).toBe('function')
      expect(typeof system.uninstall).toBe('function')
      expect(typeof system.list).toBe('function')
      expect(typeof system.update).toBe('function')
      expect(typeof system.load).toBe('function')
    })

    it('should throw error for invalid plugin ID when created directly', () => {
      expect(() => new NpmPluginSystem('Invalid-ID')).toThrow('Invalid plugin ID')
    })

    it('should clear loader cache before install and update', async () => {
      const system = new NpmPluginSystem('test-cache')
      const pluginLoader = (system as any).pluginLoader
      const npmManager = (system as any).npmManager

      pluginLoader.cache.set('my-plugin', { cached: true })
      vi.spyOn(npmManager, 'install').mockResolvedValue(undefined)

      await system.install('my-plugin', '1.0.0')
      expect(pluginLoader.cache.has('my-plugin')).toBe(false)

      pluginLoader.cache.set('my-plugin', { cached: true })
      await system.update('my-plugin', '2.0.0')
      expect(pluginLoader.cache.has('my-plugin')).toBe(false)
      expect(npmManager.install).toHaveBeenCalledWith('my-plugin', '2.0.0')
    })

    it('should resolve plugin package path correctly', () => {
      const system = new NpmPluginSystem('test-resolve')

      const basePath = system.resolve('my-plugin')
      expect(basePath).toContain('node_modules/my-plugin')
      expect(basePath).toContain('.test-resolve')

      const filePath = system.resolve('my-plugin', 'assets', 'logo.png')
      expect(filePath).toContain('node_modules/my-plugin')
      expect(filePath).toContain('assets')
      expect(filePath).toContain('logo.png')
    })

    it('should return list items with name, package and plugin sections', async () => {
      const system = new NpmPluginSystem('test-list')
      const npmManager = (system as any).npmManager

      vi.spyOn(npmManager, 'list').mockResolvedValue({
        'my-plugin': {
          package: {
            version: '1.0.0',
            description: 'desc',
            author: 'Alice',
            homepage: 'https://example.com'
          },
          plugin: {
            root: '/tmp/.test-list/node_modules/my-plugin',
            isLocal: false
          }
        }
      })

      const list = await system.list()

      expect(list).toEqual([{
        name: 'my-plugin',
        package: {
          version: '1.0.0',
          description: 'desc',
          author: 'Alice',
          homepage: 'https://example.com'
        },
        plugin: {
          root: '/tmp/.test-list/node_modules/my-plugin',
          isLocal: false
        }
      }])
    })
  })
})
