import type { KitMeta } from '../core/types'
import { join } from 'pathe'
import { createAsyncLock, pathExists, readJsonFile, writeJsonFile } from '../utils'
import { KIT_META_FILE } from './constants'

export class KitMetaStore {
  private readonly metaPath: string
  private readonly withLock = createAsyncLock()

  constructor(pluginDir: string) {
    this.metaPath = join(pluginDir, KIT_META_FILE)
  }

  async read(): Promise<KitMeta | null> {
    if (!(await pathExists(this.metaPath)))
      return null
    return await readJsonFile<KitMeta>(this.metaPath)
  }

  async write(meta: KitMeta): Promise<void> {
    await this.withLock(async () => {
      await writeJsonFile(this.metaPath, meta)
    })
  }
}
