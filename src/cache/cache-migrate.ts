import type { CachedPlugin, KitMeta, NpmPackageInfo } from '../core/types'
import { join } from 'pathe'
import { isLocalPath } from '../utils'
import { CURRENT_CACHE_VERSION } from './constants'

interface LegacyCacheEntry {
  version?: string
  resolved?: string
  overridden?: boolean
  description?: string
}

export function isV1CacheEntry(entry: unknown): entry is CachedPlugin {
  if (!entry || typeof entry !== 'object')
    return false
  const e = entry as Record<string, unknown>
  return typeof e.package === 'object' && e.package !== null
    && typeof e.plugin === 'object' && e.plugin !== null
}

export function isLegacyCacheEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object')
    return false
  if (isV1CacheEntry(entry))
    return false
  const e = entry as Record<string, unknown>
  return 'version' in e || 'resolved' in e || 'overridden' in e || 'description' in e
}

export function needsMigration(meta: KitMeta | null, cache: Record<string, unknown>): boolean {
  if (!meta || meta.cacheVersion < CURRENT_CACHE_VERSION)
    return Object.keys(cache).length > 0 && Object.values(cache).some(isLegacyCacheEntry)
  return Object.values(cache).some(isLegacyCacheEntry)
}

export function migrateLegacyEntry(
  pkgName: string,
  entry: LegacyCacheEntry,
  pluginDir: string
): CachedPlugin {
  const resolved = typeof entry.resolved === 'string' ? entry.resolved : ''
  return {
    package: {
      version: entry.version ?? '',
      description: entry.description ?? '',
      author: undefined
    },
    plugin: {
      root: join(pluginDir, 'node_modules', pkgName),
      isLocal: resolved ? isLocalPath(resolved) : false
    }
  }
}

export function migrateCache(
  cache: Record<string, unknown>,
  pluginDir: string
): Record<string, CachedPlugin> {
  const result: Record<string, CachedPlugin> = {}

  for (const [pkgName, entry] of Object.entries(cache)) {
    if (isV1CacheEntry(entry)) {
      result[pkgName] = entry
    }
    else if (isLegacyCacheEntry(entry)) {
      result[pkgName] = migrateLegacyEntry(pkgName, entry as LegacyCacheEntry, pluginDir)
    }
  }

  return result
}

export function getNpmListDependencies(stdout: string): Record<string, NpmPackageInfo> {
  try {
    return JSON.parse(stdout).dependencies || {}
  }
  catch {
    return {}
  }
}
