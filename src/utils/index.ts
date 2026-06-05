import type { PluginOptions } from '../core/types'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { cwd } from 'node:process'
import { dirname, isAbsolute, join, resolve } from 'pathe'

export async function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false)
}

export async function readJsonFile<T = any>(path: string): Promise<T> {
  return readFile(path, 'utf8').then(JSON.parse)
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2))
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export function createAsyncLock() {
  let lock: Promise<void> = Promise.resolve()

  return async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    const prev = lock
    lock = prev.then(() => next)
    await prev
    try {
      return await fn()
    }
    finally {
      release()
    }
  }
}

export function validatePluginId(pluginId: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(pluginId) && pluginId.length >= 3
}

export function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

export function getPluginDir(pluginId: string, options?: PluginOptions): string {
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

export function resolveLocalPath(packageName: string, workingDir: string = cwd()): string {
  if (packageName.startsWith('file:')) {
    const path = packageName.slice(5) // 移除 'file:' 前缀
    return isAbsolute(path) ? path : resolve(workingDir, path)
  }

  return resolve(workingDir, packageName)
}

export async function validateLocalPath(localPath: string): Promise<boolean> {
  try {
    const packageJsonPath = join(localPath, 'package.json')
    return await pathExists(packageJsonPath)
  }
  catch {
    return false
  }
}

interface PackageJsonEntry {
  main?: string
  module?: string
  exports?: string | Record<string, string | Record<string, string>>
}

export function resolvePackageEntry(packagePath: string, packageJson: PackageJsonEntry): string {
  if (packageJson.main)
    return join(packagePath, packageJson.main)

  if (packageJson.module)
    return join(packagePath, packageJson.module)

  const exports = packageJson.exports
  if (exports) {
    if (typeof exports === 'string')
      return join(packagePath, exports)

    const dot = exports['.']
    if (dot) {
      if (typeof dot === 'string')
        return join(packagePath, dot)
      const subpath = dot.import || dot.require || dot.default
      if (typeof subpath === 'string')
        return join(packagePath, subpath)
    }
  }

  return join(packagePath, 'index.js')
}
