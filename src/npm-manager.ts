import type { NpmPackageInfo, SearchResult } from './types'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'pathe'
import { PluginCache } from './cache'
import { ensureDir, isLocalPath, pathExists, readJsonFile, resolveLocalPath, shellEscape, validateLocalPath } from './utils'

const execAsync = promisify(exec)

interface NpmManagerOptions {
  registry?: string
  npmPath?: string
}

export class NpmManager {
  private readonly registry: string
  private readonly npmCommand: string
  private readonly cache: PluginCache

  constructor(
    private pluginDir: string,
    options: NpmManagerOptions = {}
  ) {
    this.registry = options.registry || 'https://registry.npmjs.org'
    this.npmCommand = options.npmPath || 'npm'
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
      const { name, info } = await this.getLocalPackageInfo(spec)
      await this.cache.updateOne(name, info)
      return
    }

    await this.installFromRegistry(spec, version)
    const info = await this.getPackageInfo(spec)
    if (!info) {
      throw new Error(`Failed to get package info for ${spec}, package.json may not exist`)
    }
    await this.cache.updateOne(spec, info)
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

  async list(): Promise<Record<string, NpmPackageInfo>> {
    const cacheData = await this.cache.read()
    if (Object.keys(cacheData).length > 0) {
      const validated = await this.validateCache(cacheData)
      if (Object.keys(validated).length > 0) {
        if (Object.keys(validated).length !== Object.keys(cacheData).length) {
          await this.cache.rebuild(validated)
        }
        return validated
      }
    }

    const command = `list --prefix ${shellEscape(this.pluginDir)} --depth=0 --json`
    let dependencies: Record<string, NpmPackageInfo> = {}
    try {
      const { stdout } = await this.executeNpmCommand(command)
      dependencies = JSON.parse(stdout).dependencies || {}
    }
    catch (error: any) {
      if (error.stdout) {
        try {
          dependencies = JSON.parse(error.stdout).dependencies || {}
        }
        catch {
          dependencies = {}
        }
      }
    }

    await Promise.all(
      Object.entries(dependencies).map(async ([pkg, info]) => {
        const pkgJson = await this.readInstalledPackageJson(pkg)
        info.description = pkgJson?.description || ''
      })
    )

    await this.cache.rebuild(dependencies)
    return dependencies
  }

  private async validateCache(cacheData: Record<string, NpmPackageInfo>): Promise<Record<string, NpmPackageInfo>> {
    const entries = await Promise.all(
      Object.entries(cacheData).map(async ([pkg, info]) => {
        const packagePath = join(this.pluginDir, 'node_modules', pkg)
        if (!(await pathExists(packagePath)))
          return null
        return [pkg, info] as const
      })
    )

    return Object.fromEntries(entries.filter(entry => entry !== null))
  }

  private async getLocalPackageInfo(spec: string): Promise<{ name: string, info: NpmPackageInfo }> {
    const localPath = resolveLocalPath(spec)
    const pkg = await readJsonFile(join(localPath, 'package.json'))
    const name = pkg.name

    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Local package at ${localPath} must define a valid name in package.json`)
    }

    return {
      name,
      info: {
        version: pkg.version || '',
        resolved: '',
        overridden: false,
        description: pkg.description || ''
      }
    }
  }

  private async readInstalledPackageJson(packageName: string): Promise<Record<string, any> | null> {
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

  private async getPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
    const pkg = await this.readInstalledPackageJson(packageName)
    if (!pkg)
      return null
    return {
      version: pkg.version,
      resolved: '',
      overridden: false,
      description: pkg.description || ''
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
    return pkg?.version ?? null
  }
}
