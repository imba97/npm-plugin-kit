import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NpmManager } from '../src/npm-manager'

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
  it('should sync local install info into .plugins.json using the installed package name', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const localPackageDir = await createTempDir('npm-plugin-kit-local-package-')

    await writeFile(join(localPackageDir, 'package.json'), JSON.stringify({
      name: 'local-plugin',
      version: '1.2.3',
      description: 'local plugin'
    }))

    const manager = new NpmManager(pluginDir)

    vi.spyOn(manager as never, 'executeNpmCommand' as never).mockImplementation(async () => {
      const installedPackageDir = join(pluginDir, 'node_modules', 'local-plugin')
      await mkdir(installedPackageDir, { recursive: true })
      await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
        name: 'local-plugin',
        version: '1.2.3',
        description: 'local plugin'
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
        version: '1.2.3',
        resolved: '',
        overridden: false,
        description: 'local plugin'
      }
    })
  })

  it('should drop stale cache entries when node_modules is missing', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const installedPackageDir = join(pluginDir, 'node_modules', 'kept-plugin')

    await mkdir(installedPackageDir, { recursive: true })
    await writeFile(join(installedPackageDir, 'package.json'), JSON.stringify({
      name: 'kept-plugin',
      version: '1.0.0',
      description: 'still installed'
    }))
    await writeFile(join(pluginDir, '.plugins.json'), JSON.stringify({
      'kept-plugin': {
        version: '1.0.0',
        resolved: '',
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

    const manager = new NpmManager(pluginDir)
    const list = await manager.list()

    expect(list).toEqual({
      'kept-plugin': {
        version: '1.0.0',
        resolved: '',
        overridden: false,
        description: 'still installed'
      }
    })

    const cacheRaw = await readFile(join(pluginDir, '.plugins.json'), 'utf-8')
    expect(JSON.parse(cacheRaw)).toEqual(list)
  })

  it('should escape special characters in npm commands', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const manager = new NpmManager(pluginDir, {
      registry: 'https://registry.example.com?q=1'
    })

    const executeNpmCommand = vi.spyOn(manager as never, 'executeNpmCommand' as never)
      .mockResolvedValue({ stdout: '[]', stderr: '' } as never)

    await manager.search(`plugin's name`)

    expect(executeNpmCommand).toHaveBeenCalledWith(
      `search 'plugin'\\''s name' --json --registry 'https://registry.example.com?q=1'`
    )
  })
})
