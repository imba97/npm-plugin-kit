import { describe, expect, it } from 'vitest'
import {
  extractPackageFields,
  getNestedValue,
  hasMissingPackageFields,
  mergeMissingPackageFields,
  setNestedValue
} from '../../src/cache/package-cache'

describe('package-cache', () => {
  it('should read and write nested values', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'repository.url', 'git@github.com:example/repo.git')

    expect(getNestedValue(obj, 'repository.url')).toBe('git@github.com:example/repo.git')
    expect(obj).toEqual({
      repository: { url: 'git@github.com:example/repo.git' }
    })
  })

  it('should extract fields for true, string and string[] cacheFields', () => {
    const pkgJson = {
      'name': 'demo',
      'homepage': 'https://example.com',
      'repository': { type: 'git', url: 'git@github.com:example/repo.git' },
      'test-app': { category: 'tool' }
    }

    expect(extractPackageFields(pkgJson, 'test-app', true)).toEqual({
      'test-app': { category: 'tool' }
    })

    expect(extractPackageFields(pkgJson, 'test-app', 'homepage')).toEqual({
      homepage: 'https://example.com'
    })

    expect(extractPackageFields(pkgJson, 'test-app', ['homepage', 'repository.url'])).toEqual({
      homepage: 'https://example.com',
      repository: { url: 'git@github.com:example/repo.git' }
    })
  })

  it('should treat empty version as missing', () => {
    expect(hasMissingPackageFields({ version: '', description: 'x', author: 'a' }, 'test-app')).toBe(true)
    expect(hasMissingPackageFields({ version: '1.0.0', description: 'x', author: 'a' }, 'test-app')).toBe(false)
  })

  it('should merge only missing package fields', () => {
    const pkgJson = {
      version: '2.0.0',
      description: 'new desc',
      author: 'Alice',
      homepage: 'https://new.example.com'
    }

    const merged = mergeMissingPackageFields(
      { version: '', description: 'old', author: 'Bob' },
      pkgJson,
      'test-app',
      ['homepage']
    )

    expect(merged).toEqual({
      version: '2.0.0',
      description: 'old',
      author: 'Bob',
      homepage: 'https://new.example.com'
    })
  })
})
