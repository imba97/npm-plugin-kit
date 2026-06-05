import type { NpmPackageInfo } from './types'
import { join } from 'pathe'
import { PLUGINS_CACHE_FILE } from './constants'
import { pathExists, readJsonFile, writeJsonFile } from './utils'

export class PluginCache {
  private cachePath: string
  private lock: Promise<void> = Promise.resolve()

  constructor(pluginDir: string) {
    this.cachePath = join(pluginDir, PLUGINS_CACHE_FILE)
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    const prev = this.lock
    this.lock = prev.then(() => next)
    await prev
    try {
      return await fn()
    }
    finally {
      release()
    }
  }

  async read(): Promise<Record<string, NpmPackageInfo>> {
    if (!(await pathExists(this.cachePath)))
      return {}
    return await readJsonFile(this.cachePath)
  }

  async write(data: Record<string, NpmPackageInfo>): Promise<void> {
    await writeJsonFile(this.cachePath, data)
  }

  async updateOne(pkg: string, info: NpmPackageInfo): Promise<void> {
    await this.withLock(async () => {
      const cache = await this.read()
      cache[pkg] = info
      await this.write(cache)
    })
  }

  async removeOne(pkg: string): Promise<void> {
    await this.withLock(async () => {
      const cache = await this.read()
      if (pkg in cache) {
        delete cache[pkg]
        await this.write(cache)
      }
    })
  }

  async rebuild(all: Record<string, NpmPackageInfo>): Promise<void> {
    await this.withLock(async () => {
      await this.write(all)
    })
  }
}
