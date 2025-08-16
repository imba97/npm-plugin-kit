import { homedir } from 'node:os'
import { join } from 'pathe'

export function validatePluginId(pluginId: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(pluginId) && pluginId.length >= 3
}

export function getPluginDir(pluginId: string, options?: any): string {
  if (options?.pluginDir) {
    return typeof options.pluginDir === 'function'
      ? options.pluginDir()
      : options.pluginDir
  }
  return join(homedir(), `.${pluginId}`)
}
