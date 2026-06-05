# npm-plugin-kit

A simple and powerful npm-based plugin system.

## Installation

```bash
npm install npm-plugin-kit
```

## Quick Start

```typescript
import { createNpmPlugin } from 'npm-plugin-kit'

interface MyPlugin {
  doSomething: () => void
}

const pluginSystem = createNpmPlugin<MyPlugin>('plugin-id')

await pluginSystem.install('@my-app/plugin')
// Plugins are installed to ~/.plugin-id by default
const plugin = await pluginSystem.load('@my-app/plugin')

plugin.doSomething()
```

## Custom npm Path

For Electron applications or custom environments, specify a custom npm executable:

```typescript
const pluginSystem = createNpmPlugin('plugin-id', {
  npmPath: '/path/to/npm'
})
```

## Plugin List & Cache

`list()` returns installed plugins with `package` (from `package.json`) and `plugin` (install metadata) separated:

```typescript
const plugins = await pluginSystem.list()

plugins[0].name // package name (cache key)
plugins[0].package.version
plugins[0].package.description
plugins[0].package.author
plugins[0].plugin.root // absolute install directory
plugins[0].plugin.isLocal // installed from local path
```

### Custom Cache Fields

Extract extra fields from each plugin's `package.json` via `cacheFields`:

```typescript
interface MyExtra {
  homepage: string
  repository: { type: string, url: string }
}

const pluginSystem = createNpmPlugin<MyPlugin, MyExtra>('my-app', {
  cacheFields: ['homepage', 'repository']
})

const plugins = await pluginSystem.list()
plugins[0].package.homepage
plugins[0].package.repository.url
```

`cacheFields` supports three forms:

| Value | Behavior |
|-------|----------|
| `true` | Read `package.json[pluginSystemId]` (e.g. `package.json['my-app']`) |
| `string` | Dot-path field, e.g. `'repository.url'` |
| `string[]` | Multiple dot-path fields, e.g. `['homepage', 'repository']` |

`author` is always included in `package` without configuring `cacheFields`.

`list()` automatically fills missing `package` / `plugin` fields from installed `package.json` and filesystem.

### Cache Files

In the plugin directory (default `~/.{id}`):

**`.plugins.json`** — plugin list cache (v1 structure):

```json
{
  "my-plugin": {
    "package": {
      "version": "1.0.0",
      "description": "...",
      "author": "Alice"
    },
    "plugin": {
      "root": "/Users/me/.my-app/node_modules/my-plugin",
      "isLocal": false
    }
  }
}
```

**`.npm-plugin-kit.json`** — kit metadata:

```json
{
  "cacheVersion": 1
}
```

Older flat cache formats are automatically migrated to v1 on the next `list()` call.

## API Reference

### `createNpmPlugin<TPlugin, TExtra>(id: string, options?: PluginOptions)`

Creates a plugin system instance.

**Parameters:**
- `id` - Unique identifier for your plugin system (e.g. `'plugin-id'`)
- `options.pluginDir` - Custom plugin directory (default: `~/.{id}`)
- `options.registry` - Custom npm registry URL
- `options.npmPath` - Custom npm executable path (default: `'npm'`)
- `options.cacheFields` - Extra `package.json` fields to cache in `package` section

**Returns:** `PluginSystem<TPlugin, TExtra>`

### Plugin System Methods

| Method | Description |
|--------|-------------|
| `install(name, version?)` | Install a plugin package |
| `uninstall(name)` | Remove a plugin package |
| `load<T>(name)` | Load and return plugin module |
| `list()` | List all installed plugins |
| `search(keyword)` | Search npm registry for plugins |
| `view(name)` | Look up an exact package name on the registry |
| `update(name, version?)` | Update plugin to new version |
| `resolve(name, ...paths)` | Resolve path under plugin install directory |
