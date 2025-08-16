import type { PluginInfo, PluginOptions, PluginSystem, SearchResult } from './types'
import { NpmManager } from './npm-manager'
import { PluginLoader } from './plugin-loader'
import { getPluginDir, validatePluginId } from './utils'

export class NpmPluginSystem<T = any> implements PluginSystem<T> {
  private readonly npmManager: NpmManager
  private readonly pluginLoader: PluginLoader

  constructor(id: string, options: PluginOptions = {}) {
    if (!validatePluginId(id)) {
      throw new Error(`Invalid plugin ID: ${id}`)
    }

    const pluginDir = getPluginDir(id, options)
    this.npmManager = new NpmManager(pluginDir, {
      registry: options.registry,
      npmPath: options.npmPath
    })
    this.pluginLoader = new PluginLoader(pluginDir)
  }

  async search(keyword: string): Promise<SearchResult[]> {
    return await this.npmManager.search(keyword)
  }

  async install(packageName: string, version?: string): Promise<void> {
    await this.npmManager.install(packageName, version)
  }

  async uninstall(packageName: string): Promise<void> {
    this.pluginLoader.unload(packageName)
    await this.npmManager.uninstall(packageName)
  }

  async list(): Promise<PluginInfo[]> {
    const installed = await this.npmManager.list()
    return Object.entries(installed).map(([name, info]) => ({
      name,
      version: (info as any).version
    }))
  }

  async update(packageName: string, version?: string): Promise<void> {
    await this.uninstall(packageName)
    await this.install(packageName, version)
  }

  async load(packageName: string): Promise<T> {
    return await this.pluginLoader.load(packageName)
  }
}
