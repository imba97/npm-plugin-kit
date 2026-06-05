import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  isLegacyCacheEntry,
  isV1CacheEntry,
  migrateCache,
  migrateLegacyEntry,
  needsMigration
} from '../../src/cache/cache-migrate'

const pluginDir = '/tmp/.test-app'

describe('cache-migrate', () => {
  it('should detect legacy and v1 cache entries', () => {
    expect(isLegacyCacheEntry({
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz',
      overridden: false,
      description: 'demo'
    })).toBe(true)

    expect(isV1CacheEntry({
      package: { version: '1.0.0', description: 'demo', author: 'Alice' },
      plugin: { root: '/tmp/node_modules/pkg', isLocal: false }
    })).toBe(true)

    expect(isLegacyCacheEntry({
      package: { version: '1.0.0', description: 'demo', author: 'Alice' },
      plugin: { root: '/tmp/node_modules/pkg', isLocal: false }
    })).toBe(false)
  })

  it('should need migration for legacy cache without meta', () => {
    const cache = {
      pkg: {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz',
        overridden: false,
        description: 'demo'
      }
    }

    expect(needsMigration(null, cache)).toBe(true)
    expect(needsMigration({ cacheVersion: 1 }, cache)).toBe(true)
  })

  it('should migrate legacy entry and infer isLocal from resolved', () => {
    const registryEntry = migrateLegacyEntry('pkg', {
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz',
      overridden: false,
      description: 'demo'
    }, pluginDir)

    expect(registryEntry).toEqual({
      package: { version: '1.0.0', description: 'demo', author: undefined },
      plugin: { root: join(pluginDir, 'node_modules', 'pkg'), isLocal: false }
    })

    const localEntry = migrateLegacyEntry('pkg', {
      version: '1.0.0',
      resolved: 'file:../local-plugin',
      overridden: false,
      description: 'demo'
    }, pluginDir)

    expect(localEntry.plugin.isLocal).toBe(true)
  })

  it('should migrate mixed cache records', () => {
    const migrated = migrateCache({
      legacy: {
        version: '1.0.0',
        resolved: '',
        overridden: false,
        description: 'old'
      },
      modern: {
        package: { version: '2.0.0', description: 'new', author: 'Bob' },
        plugin: { root: join(pluginDir, 'node_modules', 'modern'), isLocal: false }
      }
    }, pluginDir)

    expect(migrated.legacy.package).toEqual({
      version: '1.0.0',
      description: 'old',
      author: undefined
    })
    expect(migrated.modern).toEqual({
      package: { version: '2.0.0', description: 'new', author: 'Bob' },
      plugin: { root: join(pluginDir, 'node_modules', 'modern'), isLocal: false }
    })
  })
})
