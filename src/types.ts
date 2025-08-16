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
}

export interface PluginSystem<T = any> {
  search: (keyword: string) => Promise<SearchResult[]>
  install: (packageName: string, version?: string) => Promise<void>
  uninstall: (packageName: string) => Promise<void>
  list: () => Promise<PluginInfo[]>
  update: (packageName: string, version?: string) => Promise<void>
  load: (packageName: string) => Promise<T>
}

export interface SearchResult {
  name: string
  version: string
  description?: string
}

export interface PluginInfo {
  name: string
  version: string
}
