# Modules System

## Overview

The modules system is a config-driven plugin pipeline for external tooling.

- Configuration registry: `module_config.json`
- Wrapper classes: `src/modules`
- External binaries/models/artifacts: `modules`
- Tooling entry points: `src/tools/install-submodules.ts`, `src/tools/create-module-template.ts`

Core goals:

- deterministic module discovery,
- minimal boilerplate for new modules,
- reusable install/runtime primitives,
- explicit separation between orchestration and payload.

## Topology

```text
server/
  module_config.json            # Module registry
  modules/                      # External module payloads
  src/
    modules/                    # TypeScript wrappers
      base-module.ts
      *-module.ts
    tools/                      # Orchestration scripts
      module-config-utils.ts
      install-submodules.ts
      create-module-template.ts
```

## Registry

Each top-level key in `module_config.json` is a module id.

Installer discovery requires:

- value is an object,
- `moduleFile` is a non-empty string,
- `moduleFile` resolves to an existing file in `src/modules`.

Optional:

- `aliases: string[]` for CLI filter matching.

All other fields are module-specific runtime/install configuration and are allowed.

Example:

```json
{
  "MotionCor3": {
    "moduleFile": "motion-cor3-module.ts",
    "aliases": ["motion-cor3", "motioncor3"],
    "path": "./modules/motioncor3/"
  }
}
```

## Base Module Interface

`src/modules/base-module.ts` defines the module contract.

### Static installer hook

```ts
static async installModule(moduleId, context): Promise<void>
```

- default implementation is no-op,
- only overridden implementations are executed by installer orchestration.

### Validation helpers

- `validatePathExists`
- `validateFileExists`
- `validateDirectoryExists`

Use these for fail-fast runtime checks in wrapper constructors and module methods.

## Install Pipeline

Command:

```bash
npm run modules:install
```

Script: `src/tools/install-submodules.ts`

### Execution algorithm

1. parse flags (`--skip`, `--only`),
2. read module registry,
3. validate each entry with `moduleInstallerEntrySchema`,
4. dynamically import each `moduleFile`,
5. select first exported subclass of `BaseModule` with overridden `installModule`,
6. build `ModuleInstallContext`,
7. execute installers that pass filter rules.

#### Filter examples

```bash
npm run modules:install -- --skip Ilastik
npm run modules:install -- --only MotionCor3
npm run modules:install -- --skip ilastik,imod
```

## Create Pipeline

Command:

```bash
npm run modules:create -- <module-id-or-name> [--aliases a,b] [--force]
```

Script: `src/tools/create-module-template.ts`

### Execution algorithm

1. parse positional module input,
2. derive id (`PascalCase`) and slug (`kebab-case`),
3. create wrapper template in `src/modules/<slug>-module.ts`,
4. create payload directory `modules/<slug>/`,
5. append entry in `module_config.json`.

Derived defaults:

- class name: `<ModuleId>Module`,
- aliases: `[slug, slugWithoutHyphens]` plus user aliases,
- path: `./modules/<slug>/`.

Examples:

```bash
npm run modules:create -- "Super Module"
npm run modules:create -- NanoOetzi --aliases nano-oetzi,nanooetzi
npm run modules:create -- TestModule --force
```

## Adding a New Module

1. Scaffold:

```bash
npm run modules:create -- "My Module" --aliases my-module,mymodule
```

2. Implement installer logic in generated wrapper by overriding static `installModule`.

3. Add and validate runtime schema (recommended): parse module-specific settings from `module_config.json` with zod.

4. Test installer path:

```bash
npm run modules:install -- --only MyModule
```

## Performance and Cache

`.module-cache` is a reusable artifact cache for installers.

- `cacheSet(source, cachePath)` persists artifacts,
- `cacheGet(cachePath, target)` restores artifacts.

Use cache for large archives and expensive build outputs to reduce setup latency.

## Quick Commands

```bash
# Scaffold module wrapper and registry entry
npm run modules:create -- MyModule

# Scaffold with explicit aliases
npm run modules:create -- MyModule --aliases my-module,mymodule

# Overwrite generated wrapper template
npm run modules:create -- MyModule --force

# Run all installers
npm run modules:install

# Run selected installers
npm run modules:install -- --only MyModule
npm run modules:install -- --skip Ilastik,NanoOetzi
```
