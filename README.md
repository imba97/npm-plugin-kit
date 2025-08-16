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

## API Reference

### `createNpmPlugin<T>(id: string, options?: PluginOptions)`

Creates a plugin system instance.

**Parameters:**
- `id` - Unique identifier for your plugin system (e.g., 'plugin-id')
- `options.pluginDir` - Custom plugin directory (default: `~/.{id}`)
- `options.registry` - Custom npm registry URL
- `options.npmPath` - Custom npm executable path (default: 'npm')

**Returns:** `PluginSystem<T>`

### Plugin System Methods

| Method | Description |
|--------|-------------|
| `install(name, version?)` | Install a plugin package |
| `uninstall(name)` | Remove a plugin package |
| `load<T>(name)` | Load and return plugin module |
| `list()` | List all installed plugins |
| `search(keyword)` | Search npm registry for plugins |
| `update(name, version?)` | Update plugin to new version |
