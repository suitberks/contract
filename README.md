# @suitberks/contract

A TypeScript CLI for building contract packages that define shared types and interfaces for npm-compatible registries.

Instead of syncing contracts over HTTP between services, this library generates publishable packages containing bundled TypeScript type definitions. Services consume these packages through standard JavaScript package managers.

---

## Installation

```bash
# Configure GitHub Packages authentication before installation.
npm install -g @suitberks/contract

# bun
bun add -g @suitberks/contract
```

Or run without installing:

```bash
bunx @suitberks/contract <command>
```

GitHub Packages requires authentication even for public npm packages. Configure the personal scope once before
installing the CLI:

```toml
# bunfig.toml
[install.scopes]
"@suitberks" = { token = "$PACKAGES_READ_TOKEN", url = "https://npm.pkg.github.com" }
```

> Requires `typescript >= 5.9` and `jiti >= 2.6` as peer dependencies.

---

## What is a contract?

A contract is a versioned set of TypeScript type definitions that one service publishes and other services consume. For example:

- **Service A** defines types for "API responses", "request models", etc.
- **Service A** publishes a contract package `@company-contracts/service-a`
- **Service B** installs and imports: `import type * as ServiceAContracts from '@company-contracts/service-a/api'`

---

## Quick Start

### Initialize

```bash
bunx contract init
```

This creates:

- `contract.config.ts` - Configuration file
- `contract/manifests/` - Directory for contract definitions
- `contract/generated/` - Output directory for bundled declarations
- `contract/package/` - Output directory for publishable package

### Define Contracts

Edit `contract/manifests/contract.<name>.manifest.ts`:

```typescript
// contract/manifests/contract.api.manifest.ts

export interface UserCreateRequest {
  email: string;
  name: string;
}

export interface UserCreateResponse {
  id: string;
  createdAt: string;
}
```

For emitted runtime values, prefer this shape:

```typescript
export { PBACPermissionsRecord } from '@/app/domain/permissions/permissions.constants';
```

Keep `permissions.constants.ts` as a leaf runtime file with no unrelated runtime imports.

### Build Declarations

```bash
bunx contract build
```

This bundles each manifest into a standalone `.d.ts` file using Rolldown and the native TypeScript 7 declaration generator.
If a contract name is listed in `emit` inside `contract.config.ts`, the build also emits a runtime `.js` file for that manifest.

For `emit` contracts, keep runtime exports narrow:

- re-export directly from the concrete file that owns the value
- avoid barrel files for runtime exports
- keep that source file free of unrelated runtime imports when possible

### Prepare Package

```bash
bunx contract prepare:package
```

This creates a publishable package in `contract/package/`:

```
contract/package/
  ├── package.json          # Package metadata
  ├── index.d.ts            # Exports all contracts
  ├── index.js              # Runtime entrypoint for emitted contracts
  ├── api.d.ts              # Contract: api
  ├── api.js                # Runtime contract module when emitted
  ├── types.d.ts            # Contract: types
  └── types.js              # Stub
```

Hash state is stored at `contract/.contract-package-state.json`.

**Automatic versioning:**

The command automatically bumps the patch version if the generated contract files have changed:

- First run: stores a content hash, version unchanged
- Content unchanged: version stays the same
- Content changed: patch version bumps (e.g., `1.0.1 → 1.0.2`)

**Manual version overrides:**

```bash
bunx contract prepare:package --bump minor
bunx contract prepare:package --bump major
bunx contract prepare:package --no-bump
```

The `--no-bump` flag disables automatic version bumping.

### Pack Package

```bash
bunx contract pack:package
```

Creates a `.tgz` archive of the prepared package in `contract/package/`.

### Publish Package

```bash
bunx contract publish:package
```

Publishes the prepared package to the configured npm-compatible registry. The CLI writes a temporary `.npmrc` inside `contract/package`, uses it for registry inspection and publication, and removes it afterwards.

If the current version already exists in the configured registry, publishing fails and you should run:

```bash
bunx contract prepare:package --bump patch
```

**Token priority:**

1. `config.registry.token`
2. `PACKAGE_REGISTRY_TOKEN`
3. `NODE_AUTH_TOKEN`
4. `NPM_TOKEN` for backward-compatible npmjs environments

The package can also be prepared and published in one step:

```bash
bunx contract publish:package --prepare
```

The `--prepare` flag will rebuild the package before publishing.

---

## Configuration

`contract.config.ts`:

```typescript
import type { Config } from '@suitberks/contract';

const contractConfig: Config = {
  app: 'admin-service',
  contracts: ['api', 'types', 'events'],
  emit: ['events'],
  package: {
    name: '@esb-group-space/admin-service-contracts',
    version: '1.0.0',
    repository: 'https://github.com/esb-group-space/admin-service.git',
  },
  registry: {
    url: 'https://npm.pkg.github.com',
    token: process.env.PACKAGE_REGISTRY_TOKEN,
  },
};

export default contractConfig;
```

**Fields:**

- `app` - Service/app name (used in generated filenames)
- `contracts` - List of contract names to generate
- `emit` - Subset of contracts that should also publish runtime JavaScript
- `package.name` - Scoped package name accepted by the selected registry
- `package.version` - Semantic version
- `package.repository` - (Optional) Source repository associated with the published package
- `package.exports` - (Optional) Custom export field configuration
- `registry.url` - (Optional) NPM-compatible registry URL; defaults to `https://registry.npmjs.org`
- `registry.token` - (Optional) Registry token used for inspection and publication

GitHub Packages requires the package scope to match the owning user or organization. A package published by
`esb-group-space` must therefore use a name such as `@esb-group-space/office-backend-contracts`.

---

## Commands

| Command                       | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `contract init`               | Initialize contract environment and create default config |
| `contract update:environment` | Update directories and manifests based on current config  |
| `contract build`              | Bundle manifest files into `.d.ts` declarations           |
| `contract prepare:package`    | Generate a publishable package directory                  |
| `contract pack:package`       | Pack prepared package into a `.tgz` archive               |
| `contract publish:package`    | Publish to the configured registry using config/env auth  |

---

## Directory Structure

```
contract/
  ├── manifests/        # Your contract definitions (source)
  │   ├── contract.api.manifest.ts
  │   └── contract.types.manifest.ts
  ├── generated/        # Built .d.ts files (output)
  │   ├── app.contract.api.d.ts
  │   ├── app.contract.events.js
  │   └── app.contract.types.d.ts
  └── package/          # Publishable package (output)
      ├── package.json
      ├── index.d.ts
      ├── index.js
      ├── api.d.ts
      ├── events.js
      └── types.d.ts
```

---

## Consumer Usage

After publishing your contract package, consumers install and import it:

```typescript
// Consumer service
import type { UserCreateRequest } from '@company-contracts/admin-service/api';

const user: UserCreateRequest = {
  email: 'user@example.com',
  name: 'John Doe',
};
```

---

## Development Workflow

### Producer Service (publishes contracts)

```bash
# Define contracts in contract/manifests/
# Update contract.config.ts

bunx contract update:environment   # Sync manifest files
bunx contract build                # Generate .d.ts from manifests
bunx contract prepare:package      # Create package (auto-versions if content changed)
bunx contract publish:package      # Publish to configured registry
```

**Versioning behavior:**

- `prepare:package` detects content changes and bumps patch version automatically
- `publish:package` checks whether the target version already exists in the configured registry
- if version exists, publish fails and asks for manual bump (`--bump patch|minor|major`)
- Use `--bump major|minor` to manually override during prepare
- Use `--no-bump` to disable automatic bumping

**Requirements:**

- provide `registry.token` in `contract.config.ts`, or set `PACKAGE_REGISTRY_TOKEN` / `NODE_AUTH_TOKEN`

### Consumer Service (uses contracts)

```bash
# Install the contract package
bun add @company-contracts/admin-service

# Import types
import type * as AdminAPI from '@company-contracts/admin-service/api';
```

---

## Notes

- This library is **local-only** — it does not perform remote synchronization or automatic publishing
- Publishing uses a temporary `.npmrc` in `contract/package`, targets `config.registry.url`, and removes authentication after every attempt
- Contract manifests can export runtime values for contracts listed in `emit`
- For `emit`, import or re-export from direct leaf files instead of barrels or service modules with broader dependency graphs
- Use `contract update:environment` to regenerate missing files (e.g., after adding new contracts)
- Versions are automatically managed based on content changes and configured registry state
- Content hash is stored in `contract/.contract-package-state.json` for change detection
- If the package version already exists, bump it manually via `contract prepare:package --bump ...`

---

## Contributing

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- Node.js >= 20 (for tooling compatibility)

### Setup

```bash
git clone https://github.com/suitberks/contract.git
cd contract
bun install
```

### Scripts

| Script                 | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `bun run build`        | Compile CLI and library via tsdown              |
| `bun run typecheck`    | Run the native TypeScript compiler without emit |
| `bun run lint`         | Run Oxlint across all TypeScript sources        |
| `bun run format`       | Format supported project files with oxfmt       |
| `bun run format:check` | Verify project formatting without writing       |

### Project Layout

```
src/
  adapters/       # CLI framework wiring (Clipanion)
  environment/    # Config loading, validation, and env helpers
  modules/
    build/        # contract build command
    init/         # contract init command
    pack/         # contract pack:package command
    prepare/      # contract prepare:package command
    publish/      # contract publish:package command
    versioning/   # Content hashing and semver bump logic
  utilities/      # Shared utility functions
cli.entrypoint.ts # CLI entry point
index.ts          # Library public API
```

### Tech Stack

- **TypeScript 7** — native compiler used for type checking
- **tsdown** — bundle and emit TypeScript declarations
- **Oxlint** — type-aware static analysis
- **oxfmt** — code and import formatting
- **Rolldown** — bundle manifest files into single `.d.ts` files
- **Bun** — runtime and package manager
- **Clipanion** — CLI framework
- **Zod** — config schema validation
- **@clack/prompts** — interactive terminal prompts

### Making Changes

1. Edit source under `src/`
2. Run `bun run typecheck`, `bun run lint`, and `bun run format:check` to validate
3. Run `bun run build` to compile
4. Test the CLI locally: `./dist/cli.entrypoint.js <command>`

---

## License

MIT
