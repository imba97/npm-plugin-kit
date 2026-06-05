import type { MockInstance } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NpmManager } from '../../src/npm/npm-manager'

interface NpmCommandResult {
  stdout: string
  stderr: string
}

type ExecuteNpmCommand = (command: string) => Promise<NpmCommandResult>

function spyExecuteNpmCommand(manager: NpmManager): MockInstance<ExecuteNpmCommand> {
  return vi.spyOn(
    manager as unknown as { executeNpmCommand: ExecuteNpmCommand },
    'executeNpmCommand'
  )
}

const tempDirs: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()

  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('npm-manager', () => {
  it('should sync local install info into .plugins.json using v1 cache structure', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const localPackageDir = await createTempDir('npm-plugin-kit-local-package-')

    await writeFile(join(localPackageDir, 'package.json'), JSON.stringify({
      name: 'local-plugin',
      version: '1.2.3',
      description: 'local plugin',
      author: 'Alice'
    }))

    const manager = new NpmManager(pluginDir, { pluginId: 'test-app' })

    spyExecuteNpmCommand(manager).mockImplementation(async () => {
      const installedPackageDir = join(pluginDir, 'node_modules', 'local-plugin')
      await mkdir(installedPackageDir, { recursive: true })
      await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
        name: 'local-plugin',
        version: '1.2.3',
        description: 'local plugin',
        author: 'Alice'
      }))

      return {
        stdout: '',
        stderr: ''
      }
    })

    await manager.install(localPackageDir)

    const cacheRaw = await readFile(join(pluginDir, '.plugins.json'), 'utf-8')
    const cache = JSON.parse(cacheRaw)

    expect(cache).toEqual({
      'local-plugin': {
        packageInfo: {
          version: '1.2.3',
          description: 'local plugin',
          author: 'Alice'
        },
        plugin: {
          root: join(pluginDir, 'node_modules', 'local-plugin'),
          isLocal: true
        }
      }
    })

    const metaRaw = await readFile(join(pluginDir, '.npm-plugin-kit.json'), 'utf-8')
    expect(JSON.parse(metaRaw)).toEqual({ cacheVersion: 1 })
  })

  it('should write cacheFields into packageInfo section', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const localPackageDir = await createTempDir('npm-plugin-kit-local-package-')

    await writeFile(join(localPackageDir, 'package.json'), JSON.stringify({
      name: 'extra-plugin',
      version: '2.0.0',
      description: 'with extras',
      author: 'Bob',
      homepage: 'https://example.com',
      repository: { type: 'git', url: 'git@github.com:example/repo.git' }
    }))

    const manager = new NpmManager(pluginDir, {
      pluginId: 'test-app',
      cacheFields: ['homepage', 'repository']
    })

    spyExecuteNpmCommand(manager).mockImplementation(async () => {
      const installedPackageDir = join(pluginDir, 'node_modules', 'extra-plugin')
      await mkdir(installedPackageDir, { recursive: true })
      await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
        name: 'extra-plugin',
        version: '2.0.0',
        description: 'with extras',
        author: 'Bob',
        homepage: 'https://example.com',
        repository: { type: 'git', url: 'git@github.com:example/repo.git' }
      }))
      return { stdout: '', stderr: '' }
    })

    await manager.install(localPackageDir)

    const cache = JSON.parse(await readFile(join(pluginDir, '.plugins.json'), 'utf-8'))
    expect(cache['extra-plugin'].packageInfo).toMatchObject({
      homepage: 'https://example.com',
      repository: { type: 'git', url: 'git@github.com:example/repo.git' }
    })
  })

  it('should migrate v0 flat cache to v1 and enrich missing author', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const installedPackageDir = join(pluginDir, 'node_modules', 'kept-plugin')

    await mkdir(installedPackageDir, { recursive: true })
    await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
      name: 'kept-plugin',
      version: '1.0.0',
      description: 'still installed',
      author: 'Carol'
    }))
    await writeFile(join(pluginDir, '.plugins.json'), JSON.stringify({
      'kept-plugin': {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/kept-plugin/-/kept-plugin-1.0.0.tgz',
        overridden: false,
        description: 'still installed'
      },
      'removed-plugin': {
        version: '9.9.9',
        resolved: '',
        overridden: false,
        description: 'gone'
      }
    }))

    const manager = new NpmManager(pluginDir, { pluginId: 'test-app' })
    const list = await manager.list()

    expect(list).toEqual({
      'kept-plugin': {
        packageInfo: {
          version: '1.0.0',
          description: 'still installed',
          author: 'Carol'
        },
        plugin: {
          root: join(pluginDir, 'node_modules', 'kept-plugin'),
          isLocal: false
        }
      }
    })

    const cacheRaw = await readFile(join(pluginDir, '.plugins.json'), 'utf-8')
    expect(JSON.parse(cacheRaw)).toEqual(list)

    const metaRaw = await readFile(join(pluginDir, '.npm-plugin-kit.json'), 'utf-8')
    expect(JSON.parse(metaRaw)).toEqual({ cacheVersion: 1 })
  })

  it('should infer isLocal from npm list resolved when rebuilding empty cache', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const installedPackageDir = join(pluginDir, 'node_modules', 'local-plugin')

    await mkdir(installedPackageDir, { recursive: true })
    await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
      name: 'local-plugin',
      version: '1.0.0',
      description: 'local',
      author: 'Dev'
    }))

    const manager = new NpmManager(pluginDir, { pluginId: 'test-app' })

    spyExecuteNpmCommand(manager).mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: {
          'local-plugin': {
            version: '1.0.0',
            resolved: 'file:../local-plugin',
            overridden: false
          }
        }
      }),
      stderr: ''
    })

    const list = await manager.list()

    expect(list['local-plugin'].plugin.isLocal).toBe(true)
    expect(list['local-plugin'].packageInfo.author).toBe('Dev')
  })

  it('should support cacheFields true to read pluginId block from package.json', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const localPackageDir = await createTempDir('npm-plugin-kit-local-package-')

    await writeFile(join(localPackageDir, 'package.json'), JSON.stringify({
      'name': 'meta-plugin',
      'version': '1.0.0',
      'description': 'meta',
      'author': 'Dev',
      'test-app': { category: 'tool' }
    }))

    const manager = new NpmManager(pluginDir, { pluginId: 'test-app', cacheFields: true })

    spyExecuteNpmCommand(manager).mockImplementation(async () => {
      const installedPackageDir = join(pluginDir, 'node_modules', 'meta-plugin')
      await mkdir(installedPackageDir, { recursive: true })
      await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
        'name': 'meta-plugin',
        'version': '1.0.0',
        'description': 'meta',
        'author': 'Dev',
        'test-app': { category: 'tool' }
      }))
      return { stdout: '', stderr: '' }
    })

    await manager.install(localPackageDir)

    const cache = JSON.parse(await readFile(join(pluginDir, '.plugins.json'), 'utf-8'))
    expect(cache['meta-plugin'].packageInfo['test-app']).toEqual({ category: 'tool' })
  })

  it('should resolve exact package name via npm view', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const manager = new NpmManager(pluginDir, { pluginId: 'test-app' })

    const executeNpmCommand = spyExecuteNpmCommand(manager)
      .mockResolvedValue({
        stdout: JSON.stringify({
          name: 'initx-plugin-svg-writer',
          version: '0.0.1',
          description: 'Interactive SVG writer plugin for initx'
        }),
        stderr: ''
      })

    const result = await manager.view('initx-plugin-svg-writer')

    expect(executeNpmCommand).toHaveBeenCalledWith(
      `view 'initx-plugin-svg-writer' --json --registry 'https://registry.npmjs.org'`
    )
    expect(result).toEqual({
      name: 'initx-plugin-svg-writer',
      version: '0.0.1',
      description: 'Interactive SVG writer plugin for initx'
    })
  })

  it('should return null when npm view fails', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const manager = new NpmManager(pluginDir, { pluginId: 'test-app' })

    spyExecuteNpmCommand(manager)
      .mockRejectedValue(new Error('E404'))

    const result = await manager.view('missing-package')

    expect(result).toBeNull()
  })

  it('should escape special characters in npm commands', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const manager = new NpmManager(pluginDir, {
      pluginId: 'test-app',
      registry: 'https://registry.example.com?q=1'
    })

    const executeNpmCommand = spyExecuteNpmCommand(manager)
      .mockResolvedValue({ stdout: '[]', stderr: '' })

    await manager.search(`plugin's name`)

    expect(executeNpmCommand).toHaveBeenCalledWith(
      `search 'plugin'\\''s name' --json --registry 'https://registry.example.com?q=1'`
    )
  })
})
