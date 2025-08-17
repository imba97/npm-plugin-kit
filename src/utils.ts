import { homedir } from 'node:os'
import { cwd } from 'node:process'
import { pathExists } from 'fs-extra'
import { isAbsolute, join, resolve } from 'pathe'

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

export function isLocalPath(packageName: string): boolean {
  if (packageName.startsWith('file:')) {
    return true
  }

  if (isAbsolute(packageName)) {
    return true
  }

  if (/^\.\.?(?:$|\/)/.test(packageName)) {
    return true
  }

  return false
}

/**
 * 解析本地路径，返回绝对路径
 */
export function resolveLocalPath(packageName: string, workingDir: string = cwd()): string {
  // file: 协议处理
  if (packageName.startsWith('file:')) {
    const path = packageName.slice(5) // 移除 'file:' 前缀
    return isAbsolute(path) ? path : resolve(workingDir, path)
  }

  // 相对路径和绝对路径处理
  return resolve(workingDir, packageName)
}

/**
 * 验证本地路径是否存在且包含 package.json
 */
export async function validateLocalPath(localPath: string): Promise<boolean> {
  try {
    const packageJsonPath = join(localPath, 'package.json')
    return await pathExists(packageJsonPath)
  }
  catch {
    return false
  }
}
