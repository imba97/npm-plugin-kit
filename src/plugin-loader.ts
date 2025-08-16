import { pathExists, readJSON } from 'fs-extra'
import { join } from 'pathe'

export class PluginLoader<T = any> {
  private cache = new Map<string, T>()
  private x: typeof import('importx') | null = null

  constructor(private pluginDir: string) {}

  async load(packageName: string): Promise<T> {
    if (this.cache.has(packageName)) {
      return this.cache.get(packageName)!
    }

    // Lazy load importx only once
    if (!this.x) {
      this.x = await import('importx')
    }

    const packagePath = join(this.pluginDir, 'node_modules', packageName)
    const packageJsonPath = join(packagePath, 'package.json')

    if (!(await pathExists(packageJsonPath))) {
      throw new Error(`Plugin package not found: ${packageName}`)
    }

    const packageJson = await readJSON(packageJsonPath)
    const entryPath = join(packagePath, packageJson.main || 'index.js')

    try {
      const PluginClass = await this.x
        .importx(entryPath, import.meta.url)
        .then((m: { default: T }) => m.default)

      this.cache.set(packageName, PluginClass)
      return PluginClass
    }
    catch (error: any) {
      throw new Error(`Failed to load plugin ${packageName}: ${error.message}`)
    }
  }

  unload(packageName: string): boolean {
    return this.cache.delete(packageName)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.cache.keys())
  }
}
