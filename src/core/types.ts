export interface PluginOptions {
  /**
   * Custom plugin directory path or a function that returns the path
   * @default `~/.{plugin-id}`
   */
  pluginDir?: string | (() => string)

  /**
   * Custom npm registry URL
   * @default 'https://registry.npmjs.org'
   */
  registry?: string

  /**
   * Custom npm executable path
   * @default 'npm'
   */
  npmPath?: string

  /**
   * Extra fields to extract from installed plugin package.json into cache `packageInfo` section.
   * - `true` — read pkgJson[pluginSystemId]
   * - `string` — dot-path field, e.g. 'repository.url'
   * - `string[]` — multiple dot-path fields
   */
  cacheFields?: true | string | string[]
}

export interface SearchResult {
  name: string
  version: string
  description: string
}

/** package.json built-in fields stored in cache `packageInfo` section */
export interface PackageInfoBase {
  version: string
  description: string
  author: unknown
}

/** packageInfo section = built-in + user-defined fields from cacheFields */
export type PackageInfo<T extends Record<string, unknown> = Record<string, unknown>>
  = PackageInfoBase & T

/** plugin section = install metadata (not from package.json) */
export interface PluginMeta {
  /** Absolute path to node_modules/{name} */
  root: string
  /** Whether installed from a local path */
  isLocal: boolean
}

/** Cache value (key is package name) */
export interface CachedPlugin<T extends Record<string, unknown> = Record<string, unknown>> {
  packageInfo: PackageInfo<T>
  plugin: PluginMeta
}

/** list() return value */
export interface PluginInfo<T extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  packageInfo: PackageInfo<T>
  plugin: PluginMeta
}

/** npm list --json dependency item (internal, not written to cache) */
export interface NpmPackageInfo {
  version: string
  resolved: string
  overridden: boolean
}

/** .npm-plugin-kit.json structure */
export interface KitMeta {
  cacheVersion: number
}

export interface PluginSystem<
  TPlugin = any,
  TExtra extends Record<string, unknown> = Record<string, unknown>
> {
  search: (keyword: string) => Promise<SearchResult[]>
  view: (packageName: string) => Promise<SearchResult | null>
  install: (packageName: string, version?: string) => Promise<void>
  uninstall: (packageName: string) => Promise<void>
  list: () => Promise<PluginInfo<TExtra>[]>
  update: (packageName: string, version?: string) => Promise<void>
  load: (packageName: string) => Promise<TPlugin>
  resolve: (packageName: string, ...paths: string[]) => string
}
