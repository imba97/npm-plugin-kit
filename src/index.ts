import type { PluginOptions, PluginSystem } from './core/types'
import { NpmPluginSystem } from './core/plugin-system'

export function createNpmPlugin<
  TPlugin = any,
  TExtra extends Record<string, unknown> = Record<string, unknown>
>(id: string, options: PluginOptions = {}): PluginSystem<TPlugin, TExtra> {
  return new NpmPluginSystem<TPlugin, TExtra>(id, options)
}

export { NpmPluginSystem } from './core/plugin-system'
export type {
  CachedPlugin,
  KitMeta,
  NpmPackageInfo,
  PackageInfo,
  PackageInfoBase,
  PluginInfo,
  PluginMeta,
  PluginOptions,
  PluginSystem,
  SearchResult
} from './core/types'
