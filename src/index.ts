import type { PluginInfo, PluginOptions, PluginSystem } from './types'
import { NpmPluginSystem } from './plugin-system'

export function createNpmPlugin<T = any>(id: string, options: PluginOptions = {}): PluginSystem<T> {
  return new NpmPluginSystem<T>(id, options)
}

export { NpmPluginSystem } from './plugin-system'
export type { PluginInfo, PluginOptions, PluginSystem }
