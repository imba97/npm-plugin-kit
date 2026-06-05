import { describe, expect, it } from 'vitest'
import { isLocalPath, resolveLocalPath, resolvePackageEntry, shellEscape, validatePluginId } from '../../src/utils'

describe('utils', () => {
  describe('isLocalPath', () => {
    it('should detect file: protocol', () => {
      expect(isLocalPath('file:./my-plugin')).toBe(true)
      expect(isLocalPath('file:/absolute/path')).toBe(true)
      expect(isLocalPath('file:C:\\Windows\\path')).toBe(true)
    })

    it('should detect relative paths', () => {
      expect(isLocalPath('.')).toBe(true)
      expect(isLocalPath('..')).toBe(true)
      expect(isLocalPath('./my-plugin')).toBe(true)
      expect(isLocalPath('../my-plugin')).toBe(true)
    })

    it('should detect absolute paths', () => {
      expect(isLocalPath('/usr/local/plugin')).toBe(true)
      expect(isLocalPath('C:\\Projects\\plugin')).toBe(true)
      expect(isLocalPath('D:\\dev\\plugin')).toBe(true)
    })

    it('should not detect npm package names as local paths', () => {
      expect(isLocalPath('lodash')).toBe(false)
      expect(isLocalPath('@types/node')).toBe(false)
      expect(isLocalPath('my-awesome-plugin')).toBe(false)
    })

    it('should return false for empty or non-string values', () => {
      expect(isLocalPath('')).toBe(false)
      expect(isLocalPath(undefined as unknown as string)).toBe(false)
    })
  })

  describe('resolveLocalPath', () => {
    it('should resolve file: protocol paths', () => {
      const result = resolveLocalPath('file:./plugin', '/base')
      expect(result).toBe('/base/plugin')
    })

    it('should resolve relative paths', () => {
      const result = resolveLocalPath('./plugin', '/base')
      expect(result).toBe('/base/plugin')

      const result2 = resolveLocalPath('../plugin', '/base/sub')
      expect(result2).toBe('/base/plugin')
    })

    it('should handle absolute paths', () => {
      const result = resolveLocalPath('/absolute/path')
      expect(result).toBe('/absolute/path')
    })
  })

  describe('shellEscape', () => {
    it('should wrap arguments in single quotes', () => {
      expect(shellEscape('my-plugin')).toBe(`'my-plugin'`)
      expect(shellEscape(`it's fine`)).toBe(`'it'\\''s fine'`)
    })
  })

  describe('resolvePackageEntry', () => {
    it('should prefer main over module and exports', () => {
      const entry = resolvePackageEntry('/pkg', {
        main: 'main.js',
        module: 'module.js',
        exports: './exports.js'
      })
      expect(entry).toBe('/pkg/main.js')
    })

    it('should fall back to module and exports', () => {
      expect(resolvePackageEntry('/pkg', { module: 'esm.js' })).toBe('/pkg/esm.js')
      expect(resolvePackageEntry('/pkg', { exports: './dist/index.js' })).toBe('/pkg/dist/index.js')
      expect(resolvePackageEntry('/pkg', { exports: { '.': { import: './dist/index.mjs' } } })).toBe('/pkg/dist/index.mjs')
    })

    it('should default to index.js', () => {
      expect(resolvePackageEntry('/pkg', {})).toBe('/pkg/index.js')
    })
  })

  describe('validatePluginId', () => {
    it('should accept valid plugin IDs', () => {
      expect(validatePluginId('myapp')).toBe(true)
      expect(validatePluginId('my-app')).toBe(true)
      expect(validatePluginId('image-processor')).toBe(true)
      expect(validatePluginId('data-transformer')).toBe(true)
    })

    it('should reject invalid plugin IDs', () => {
      expect(validatePluginId('My-App')).toBe(false) // uppercase
      expect(validatePluginId('123-app')).toBe(false) // starts with number
      expect(validatePluginId('my_app')).toBe(false) // underscore
      expect(validatePluginId('ab')).toBe(false) // too short
    })
  })
})
