import type { NpmPackageInfo } from './types'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { ensureDir, pathExists, readJSON } from 'fs-extra'
import { join } from 'pathe'
import { PluginCache } from './cache'
import { isLocalPath, resolveLocalPath, validateLocalPath } from './utils'

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

  async install(packageName: string, version?: string): Promise<void> {
    await ensureDir(this.pluginDir)

    if (isLocalPath(packageName)) {
      await this.installFromLocal(packageName)
    }
    else {
      await this.installFromRegistry(packageName, version)
    }

    const info = await this.getPackageInfo(packageName)
    if (info) {
      await this.cache.updateOne(packageName, info)
    }
  }

  private async installFromLocal(packageName: string): Promise<void> {
    const localPath = resolveLocalPath(packageName)

    if (!(await validateLocalPath(localPath))) {
      throw new Error(`Local path does not exist or does not contain a valid package.json: ${localPath}`)
    }

    const command = `install "${localPath}" --prefix "${this.pluginDir}"`

    try {
      await this.executeNpmCommand(command)
    }
    catch (error: any) {
      throw new Error(`Failed to install plugin from local path ${localPath}: ${error.message}`)
    }
  }

  private async installFromRegistry(packageName: string, version?: string): Promise<void> {
    const versionSpec = version ? `@${version}` : ''
    const command = `install ${packageName}${versionSpec} --prefix "${this.pluginDir}" --registry ${this.registry}`

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

    const command = `uninstall ${packageName} --prefix "${this.pluginDir}"`

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
      return cacheData
    }

    const command = `list --prefix "${this.pluginDir}" --depth=0 --json`
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

    for (const [pkg, info] of Object.entries(dependencies)) {
      const desc = await this.getPackageDescription(pkg)
      info.description = desc
    }

    await this.cache.rebuild(dependencies)
    return dependencies
  }

  private async getPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
    const packageJsonPath = join(this.pluginDir, 'node_modules', packageName, 'package.json')
    if (!(await pathExists(packageJsonPath)))
      return null
    try {
      const pkg = await readJSON(packageJsonPath)
      return {
        version: pkg.version,
        resolved: '',
        overridden: false,
        description: pkg.description || ''
      }
    }
    catch {
      return null
    }
  }

  private async getPackageDescription(packageName: string): Promise<string> {
    const packageJsonPath = join(this.pluginDir, 'node_modules', packageName, 'package.json')
    if (!(await pathExists(packageJsonPath)))
      return ''
    try {
      const pkg = await readJSON(packageJsonPath)
      return pkg.description || ''
    }
    catch {
      return ''
    }
  }

  async search(keyword: string): Promise<any[]> {
    const command = `search ${keyword} --json --registry ${this.registry}`

    try {
      const { stdout } = await this.executeNpmCommand(command)
      return JSON.parse(stdout)
    }
    catch (error: any) {
      throw new Error(`Failed to search plugins: ${error.message}`)
    }
  }

  async isInstalled(packageName: string): Promise<boolean> {
    const packagePath = join(this.pluginDir, 'node_modules', packageName)
    return await pathExists(packagePath)
  }

  async getInstalledVersion(packageName: string): Promise<string | null> {
    const packageJsonPath = join(this.pluginDir, 'node_modules', packageName, 'package.json')

    if (!(await pathExists(packageJsonPath))) {
      return null
    }

    try {
      const packageJson = await readJSON(packageJsonPath)
      return packageJson.version
    }
    catch {
      return null
    }
  }
}
