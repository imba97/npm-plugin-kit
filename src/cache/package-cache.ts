import type { CachedPlugin, PackageInfoBase, PluginMeta } from '../core/types'
import { join } from 'pathe'

export type CacheFields = true | string | string[]

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object')
      return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null)
      current[key] = {}
    current = current[key] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

export function getCacheFieldPaths(cacheFields: CacheFields | undefined, pluginId: string): string[] {
  if (cacheFields === undefined)
    return []
  if (cacheFields === true)
    return [pluginId]
  if (typeof cacheFields === 'string')
    return [cacheFields]
  return cacheFields
}

export function extractPackageFields(
  pkgJson: Record<string, unknown>,
  pluginId: string,
  cacheFields?: CacheFields
): Record<string, unknown> {
  if (cacheFields === undefined)
    return {}

  const result: Record<string, unknown> = {}

  for (const path of getCacheFieldPaths(cacheFields, pluginId)) {
    const value = getNestedValue(pkgJson, path)
    if (value !== undefined)
      setNestedValue(result, path, value)
  }

  return result
}

export function getBuiltinPackageFields(pkgJson: Record<string, unknown>): PackageInfoBase {
  return {
    version: typeof pkgJson.version === 'string' ? pkgJson.version : '',
    description: typeof pkgJson.description === 'string' ? pkgJson.description : '',
    author: pkgJson.author
  }
}

export function getPluginMeta(pluginDir: string, packageName: string, isLocal: boolean): PluginMeta {
  return {
    root: join(pluginDir, 'node_modules', packageName),
    isLocal
  }
}

export function buildCacheEntry(
  pkgJson: Record<string, unknown>,
  pluginDir: string,
  packageName: string,
  isLocal: boolean,
  pluginId: string,
  cacheFields?: CacheFields
): CachedPlugin {
  return {
    package: {
      ...getBuiltinPackageFields(pkgJson),
      ...extractPackageFields(pkgJson, pluginId, cacheFields)
    },
    plugin: getPluginMeta(pluginDir, packageName, isLocal)
  }
}

export function stripStalePackageFields(
  pkg: Record<string, unknown>,
  pluginId: string,
  cacheFields?: CacheFields
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    version: pkg.version ?? '',
    description: pkg.description ?? ''
  }

  if (pkg.author !== undefined)
    result.author = pkg.author

  for (const path of getCacheFieldPaths(cacheFields, pluginId)) {
    const value = getNestedValue(pkg, path)
    if (value !== undefined)
      setNestedValue(result, path, value)
  }

  return result
}

export function hasMissingPackageFields(
  pkg: Record<string, unknown>,
  pluginId: string,
  cacheFields?: CacheFields
): boolean {
  if (pkg.version === undefined || pkg.version === '')
    return true
  if (pkg.description === undefined)
    return true
  if (pkg.author === undefined)
    return true

  for (const path of getCacheFieldPaths(cacheFields, pluginId)) {
    if (getNestedValue(pkg, path) === undefined)
      return true
  }

  return false
}

export function hasMissingPluginFields(plugin: Partial<PluginMeta>): boolean {
  return plugin.root === undefined || plugin.isLocal === undefined
}

export function hasMissingFields(
  entry: CachedPlugin,
  pluginId: string,
  cacheFields?: CacheFields
): boolean {
  return hasMissingPackageFields(entry.package as Record<string, unknown>, pluginId, cacheFields)
    || hasMissingPluginFields(entry.plugin)
}

export function mergeMissingPackageFields(
  target: Record<string, unknown>,
  pkgJson: Record<string, unknown>,
  pluginId: string,
  cacheFields?: CacheFields
): Record<string, unknown> {
  const result = stripStalePackageFields(target, pluginId, cacheFields)
  const builtin = getBuiltinPackageFields(pkgJson)

  if (result.version === undefined || result.version === '')
    result.version = builtin.version
  if (result.description === undefined)
    result.description = builtin.description
  if (result.author === undefined && builtin.author !== undefined)
    result.author = builtin.author

  const extracted = extractPackageFields(pkgJson, pluginId, cacheFields)
  for (const path of getCacheFieldPaths(cacheFields, pluginId)) {
    if (getNestedValue(result, path) === undefined) {
      const value = getNestedValue(extracted, path)
      if (value !== undefined)
        setNestedValue(result, path, value)
    }
  }

  return result
}

export function mergeMissingPluginFields(
  plugin: Partial<PluginMeta>,
  pluginDir: string,
  packageName: string
): PluginMeta {
  return {
    root: plugin.root ?? join(pluginDir, 'node_modules', packageName),
    isLocal: plugin.isLocal ?? false
  }
}
