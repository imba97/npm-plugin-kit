import type { PluginInfo, PluginOptions, PluginSystem, SearchResult } from './types'
import { join } from 'pathe'
import { NpmManager } from './npm-manager'
import { PluginLoader } from './plugin-loader'
import { getPluginDir, isLocalPath, validatePluginId } from './utils'

export class NpmPluginSystem<T = any> implements PluginSystem<T> {
  private readonly npmManager: NpmManager
  private readonly pluginLoader: PluginLoader
  private readonly pluginDir: string

  constructor(id: string, options: PluginOptions = {}) {
    if (!validatePluginId(id)) {
      throw new Error(`Invalid plugin ID: ${id}`)
    }

    const pluginDir = getPluginDir(id, options)
    this.pluginDir = pluginDir
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
      version: info.version,
      description: info.description,
      isLocal: isLocalPath(info.resolved)
    }))
  }

  async update(packageName: string, version?: string): Promise<void> {
    await this.uninstall(packageName)
    await this.install(packageName, version)
  }

  async load(packageName: string): Promise<T> {
    return await this.pluginLoader.load(packageName)
  }

  resolve(packageName: string, ...paths: string[]): string {
    const base = join(this.pluginDir, 'node_modules', packageName)
    if (paths.length === 0)
      return base
    return join(base, ...paths)
  }
}
