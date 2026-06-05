import type { CacheFields } from '../cache/package-cache'
import type { CachedPlugin, NpmPackageInfo, SearchResult } from '../core/types'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'pathe'
import { PluginCache } from '../cache/cache'
import { getNpmListDependencies } from '../cache/cache-migrate'
import {
  buildCacheEntry,
  hasMissingFields,
  mergeMissingPackageFields,
  mergeMissingPluginFields
} from '../cache/package-cache'
import { ensureDir, isLocalPath, pathExists, readJsonFile, resolveLocalPath, shellEscape, validateLocalPath } from '../utils'

const execAsync = promisify(exec)

interface NpmManagerOptions {
  pluginId: string
  registry?: string
  npmPath?: string
  cacheFields?: CacheFields
}

interface CacheUpdateResult {
  data: Record<string, CachedPlugin>
  changed: boolean
}

export class NpmManager {
  private readonly registry: string
  private readonly npmCommand: string
  private readonly cache: PluginCache
  private readonly pluginId: string
  private readonly cacheFields?: CacheFields

  constructor(
    private pluginDir: string,
    options: NpmManagerOptions
  ) {
    this.pluginId = options.pluginId
    this.registry = options.registry || 'https://registry.npmjs.org'
    this.npmCommand = options.npmPath || 'npm'
    this.cacheFields = options.cacheFields
    this.cache = new PluginCache(pluginDir)
  }

  private async executeNpmCommand(command: string): Promise<{ stdout: string, stderr: string }> {
    const fullCommand = `${this.npmCommand} ${command}`

    try {
      return await execAsync(fullCommand)
    }
    catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `npm command not found: ${this.npmCommand}. `
          + `Please ensure npm is installed or specify a custom npm path using the 'npmPath' option.`
        )
      }
      throw error
    }
  }

  async install(spec: string, version?: string): Promise<void> {
    await ensureDir(this.pluginDir)

    if (isLocalPath(spec)) {
      await this.installFromLocal(spec)
      const { name, entry } = await this.getLocalCacheEntry(spec)
      await this.cache.updateOne(name, entry)
      return
    }

    await this.installFromRegistry(spec, version)
    const entry = await this.buildCacheEntryForPackage(spec, false)
    if (!entry) {
      throw new Error(`Failed to get package info for ${spec}, package.json may not exist`)
    }
    await this.cache.updateOne(spec, entry)
  }

  private async installFromLocal(spec: string): Promise<void> {
    const localPath = resolveLocalPath(spec)

    if (!(await validateLocalPath(localPath))) {
      throw new Error(`Local path does not exist or does not contain a valid package.json: ${localPath}`)
    }

    const command = `install ${shellEscape(localPath)} --prefix ${shellEscape(this.pluginDir)}`

    try {
      await this.executeNpmCommand(command)
    }
    catch (error: any) {
      throw new Error(`Failed to install plugin from local path ${localPath}: ${error.message}`)
    }
  }

  private async installFromRegistry(packageName: string, version?: string): Promise<void> {
    const versionSpec = version ? `@${version}` : ''
    const command = `install ${shellEscape(`${packageName}${versionSpec}`)} --prefix ${shellEscape(this.pluginDir)} --registry ${shellEscape(this.registry)}`

    try {
      await this.executeNpmCommand(command)
    }
    catch (error: any) {
      throw new Error(`Failed to install plugin ${packageName}: ${error.message}`)
    }
  }

  async uninstall(packageName: string): Promise<void> {
    const packagePath = join(this.pluginDir, 'node_modules', packageName)

    if (!(await pathExists(packagePath))) {
      throw new Error(`Plugin ${packageName} is not installed`)
    }

    const command = `uninstall ${shellEscape(packageName)} --prefix ${shellEscape(this.pluginDir)}`

    try {
      await this.executeNpmCommand(command)
      await this.cache.removeOne(packageName)
    }
    catch (error: any) {
      throw new Error(`Failed to uninstall plugin ${packageName}: ${error.message}`)
    }
  }

  async list(): Promise<Record<string, CachedPlugin>> {
    const cacheData = await this.cache.ensureCache()

    if (Object.keys(cacheData).length > 0) {
      const validated = await this.validateCache(cacheData)
      const enriched = await this.enrichCache(validated.data)

      if (Object.keys(enriched.data).length > 0) {
        if (validated.changed || enriched.changed)
          await this.cache.rebuild(enriched.data)
        return enriched.data
      }
    }

    const dependencies = await this.fetchInstalledPackageNames()
    const entries = await Promise.all(
      Object.entries(dependencies).map(async ([pkg, info]) => {
        const isLocal = info.resolved ? isLocalPath(info.resolved) : false
        const entry = await this.buildCacheEntryForPackage(pkg, isLocal)
        return entry ? [pkg, entry] as const : null
      })
    )

    const rebuilt = Object.fromEntries(
      entries.filter((entry): entry is [string, CachedPlugin] => entry !== null)
    )
    await this.cache.rebuild(rebuilt)
    return rebuilt
  }

  private async fetchInstalledPackageNames(): Promise<Record<string, NpmPackageInfo>> {
    const command = `list --prefix ${shellEscape(this.pluginDir)} --depth=0 --json`
    try {
      const { stdout } = await this.executeNpmCommand(command)
      return getNpmListDependencies(stdout)
    }
    catch (error: any) {
      if (error.stdout)
        return getNpmListDependencies(error.stdout)
      return {}
    }
  }

  private async validateCache(cacheData: Record<string, CachedPlugin>): Promise<CacheUpdateResult> {
    const entries = await Promise.all(
      Object.entries(cacheData).map(async ([pkg, entry]) => {
        const packagePath = join(this.pluginDir, 'node_modules', pkg)
        if (!(await pathExists(packagePath)))
          return null
        return [pkg, entry] as const
      })
    )

    const data = Object.fromEntries(
      entries.filter((entry): entry is [string, CachedPlugin] => entry !== null)
    )

    return {
      data,
      changed: Object.keys(data).length !== Object.keys(cacheData).length
    }
  }

  private async enrichCache(cacheData: Record<string, CachedPlugin>): Promise<CacheUpdateResult> {
    let changed = false
    const result: Record<string, CachedPlugin> = {}

    for (const [pkg, entry] of Object.entries(cacheData)) {
      if (!hasMissingFields(entry, this.pluginId, this.cacheFields)) {
        result[pkg] = entry
        continue
      }

      const pkgJson = await this.readInstalledPackageJson(pkg)
      if (!pkgJson) {
        result[pkg] = entry
        continue
      }

      result[pkg] = {
        package: mergeMissingPackageFields(
          entry.package as Record<string, unknown>,
          pkgJson,
          this.pluginId,
          this.cacheFields
        ) as CachedPlugin['package'],
        plugin: mergeMissingPluginFields(entry.plugin, this.pluginDir, pkg)
      }
      changed = true
    }

    return {
      data: changed ? result : cacheData,
      changed
    }
  }

  private async getLocalCacheEntry(spec: string): Promise<{ name: string, entry: CachedPlugin }> {
    const localPath = resolveLocalPath(spec)
    const pkg = await readJsonFile<Record<string, unknown>>(join(localPath, 'package.json'))
    const name = pkg.name

    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Local package at ${localPath} must define a valid name in package.json`)
    }

    return {
      name,
      entry: buildCacheEntry(pkg, this.pluginDir, name, true, this.pluginId, this.cacheFields)
    }
  }

  private async buildCacheEntryForPackage(packageName: string, isLocal: boolean): Promise<CachedPlugin | null> {
    const pkg = await this.readInstalledPackageJson(packageName)
    if (!pkg)
      return null
    return buildCacheEntry(pkg, this.pluginDir, packageName, isLocal, this.pluginId, this.cacheFields)
  }

  private async readInstalledPackageJson(packageName: string): Promise<Record<string, unknown> | null> {
    const packageJsonPath = join(this.pluginDir, 'node_modules', packageName, 'package.json')
    if (!(await pathExists(packageJsonPath)))
      return null
    try {
      return await readJsonFile(packageJsonPath)
    }
    catch {
      return null
    }
  }

  async search(keyword: string): Promise<SearchResult[]> {
    const command = `search ${shellEscape(keyword)} --json --registry ${shellEscape(this.registry)}`

    try {
      const { stdout } = await this.executeNpmCommand(command)
      return JSON.parse(stdout)
    }
    catch (error: any) {
      throw new Error(`Failed to search plugins: ${error.message}`)
    }
  }

  async view(packageName: string): Promise<SearchResult | null> {
    const command = `view ${shellEscape(packageName)} --json --registry ${shellEscape(this.registry)}`

    try {
      const { stdout } = await this.executeNpmCommand(command)
      const pkg = JSON.parse(stdout)
      const info = Array.isArray(pkg) ? pkg[0] : pkg

      if (!info?.name)
        return null

      return {
        name: info.name,
        version: info.version || '',
        description: info.description || ''
      }
    }
    catch {
      return null
    }
  }

  async isInstalled(packageName: string): Promise<boolean> {
    const packagePath = join(this.pluginDir, 'node_modules', packageName)
    return await pathExists(packagePath)
  }

  async getInstalledVersion(packageName: string): Promise<string | null> {
    const pkg = await this.readInstalledPackageJson(packageName)
    return typeof pkg?.version === 'string' ? pkg.version : null
  }
}
