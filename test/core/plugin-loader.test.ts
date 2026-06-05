import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginLoader } from '../../src/core/plugin-loader'

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

describe('plugin-loader', () => {
  it('should resolve entry from exports when main is absent', async () => {
    const pluginDir = await createTempDir('npm-plugin-kit-plugin-dir-')
    const packageDir = join(pluginDir, 'node_modules', 'export-plugin')
    const entryFile = join(packageDir, 'dist', 'index.mjs')

    await mkdir(join(packageDir, 'dist'), { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: 'export-plugin',
      exports: { '.': { import: './dist/index.mjs' } }
    }))
    await writeFile(entryFile, 'export default { value: 42 }')

    const importx = vi.fn().mockResolvedValue({ default: { value: 42 } })
    vi.doMock('importx', () => ({ importx }))

    const loader = new PluginLoader(pluginDir)
    const plugin = await loader.load('export-plugin')

    expect(plugin).toEqual({ value: 42 })
  })
})
