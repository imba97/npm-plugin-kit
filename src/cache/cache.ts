import type { CachedPlugin } from '../core/types'
import { join } from 'pathe'
import { createAsyncLock, pathExists, readJsonFile, writeJsonFile } from '../utils'
import { migrateCache, needsMigration } from './cache-migrate'
import { CURRENT_CACHE_VERSION, PLUGINS_CACHE_FILE } from './constants'
import { KitMetaStore } from './kit-meta'

export class PluginCache {
  private readonly cachePath: string
  private readonly kitMeta: KitMetaStore
  private readonly pluginDir: string
  private readonly withLock = createAsyncLock()

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir
    this.cachePath = join(pluginDir, PLUGINS_CACHE_FILE)
    this.kitMeta = new KitMetaStore(pluginDir)
  }

  private async readRaw(): Promise<Record<string, unknown>> {
    if (!(await pathExists(this.cachePath)))
      return {}
    return await readJsonFile(this.cachePath)
  }

  private async ensureCacheInternal(): Promise<Record<string, CachedPlugin>> {
    const meta = await this.kitMeta.read()
    const raw = await this.readRaw()

    if (needsMigration(meta, raw)) {
      const migrated = migrateCache(raw, this.pluginDir)
      await writeJsonFile(this.cachePath, migrated)
      await this.kitMeta.write({ cacheVersion: CURRENT_CACHE_VERSION })
      return migrated
    }

    if (!meta)
      await this.kitMeta.write({ cacheVersion: CURRENT_CACHE_VERSION })

    return raw as Record<string, CachedPlugin>
  }

  async ensureCache(): Promise<Record<string, CachedPlugin>> {
    return await this.withLock(() => this.ensureCacheInternal())
  }

  async updateOne(pkg: string, entry: CachedPlugin): Promise<void> {
    await this.withLock(async () => {
      const cache = await this.ensureCacheInternal()
      cache[pkg] = entry
      await writeJsonFile(this.cachePath, cache)
      await this.kitMeta.write({ cacheVersion: CURRENT_CACHE_VERSION })
    })
  }

  async removeOne(pkg: string): Promise<void> {
    await this.withLock(async () => {
      const cache = await this.ensureCacheInternal()
      if (pkg in cache) {
        delete cache[pkg]
        await writeJsonFile(this.cachePath, cache)
      }
    })
  }

  async rebuild(all: Record<string, CachedPlugin>): Promise<void> {
    await this.withLock(async () => {
      await writeJsonFile(this.cachePath, all)
      await this.kitMeta.write({ cacheVersion: CURRENT_CACHE_VERSION })
    })
  }
}
