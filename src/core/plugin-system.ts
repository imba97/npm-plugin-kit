import type { PluginInfo, PluginOptions, PluginSystem, SearchResult } from './types'
import { join } from 'pathe'
import { NpmManager } from '../npm/npm-manager'
import { getPluginDir, validatePluginId } from '../utils'
import { PluginLoader } from './plugin-loader'

export class NpmPluginSystem<
  TPlugin = any,
  TExtra extends Record<string, unknown> = Record<string, unknown>
> implements PluginSystem<TPlugin, TExtra> {
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
      pluginId: id,
      registry: options.registry,
      npmPath: options.npmPath,
      cacheFields: options.cacheFields
    })
    this.pluginLoader = new PluginLoader(pluginDir)
  }

  async search(keyword: string): Promise<SearchResult[]> {
    return await this.npmManager.search(keyword)
  }

  async view(packageName: string): Promise<SearchResult | null> {
    return await this.npmManager.view(packageName)
  }

  async install(packageName: string, version?: string): Promise<void> {
    this.pluginLoader.unload(packageName)
    await this.npmManager.install(packageName, version)
  }

  async uninstall(packageName: string): Promise<void> {
    this.pluginLoader.unload(packageName)
    await this.npmManager.uninstall(packageName)
  }

  async list(): Promise<PluginInfo<TExtra>[]> {
    const installed = await this.npmManager.list()
    return Object.entries(installed).map(([name, entry]) => ({
      name,
      packageInfo: entry.packageInfo as PluginInfo<TExtra>['packageInfo'],
      plugin: entry.plugin
    }))
  }

  async update(packageName: string, version?: string): Promise<void> {
    this.pluginLoader.unload(packageName)
    await this.npmManager.install(packageName, version)
  }

  async load(packageName: string): Promise<TPlugin> {
    return await this.pluginLoader.load(packageName)
  }

  resolve(packageName: string, ...paths: string[]): string {
    const base = join(this.pluginDir, 'node_modules', packageName)
    if (paths.length === 0)
      return base
    return join(base, ...paths)
  }
}
