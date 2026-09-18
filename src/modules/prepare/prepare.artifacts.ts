import fs from 'fs-extra';

import { CONTRACT_DIRECTORY_NAME } from '@/environment/environment.constants';
import type { Config } from '@/environment/environment.schemas';

import type { PackageJsonWithVersion } from './prepare.types';

import path from 'path';

/** Resolves the generated declarations directory path. */
function getGeneratedDirPath(): string {
  return path.join(process.cwd(), CONTRACT_DIRECTORY_NAME, 'generated');
}

/** Builds package.json payload for prepared contract package. */
function generatePackageJson(config: Config, contracts: string[]): Record<string, unknown> {
  const exports: Record<string, Record<string, string>> = {
    '.': {
      types: './index.d.ts',
      default: './index.js',
    },
  };

  for (const contract of contracts) {
    exports[`./${contract}`] = {
      types: `./${contract}.d.ts`,
      default: `./${contract}.js`,
    };
  }

  const files = ['index.d.ts', 'index.js', ...contracts.flatMap((c) => [`${c}.d.ts`, `${c}.js`])];

  const packageJson: Record<string, unknown> = {
    name: config.package.name,
    description: `Shared TypeScript contract definitions for ${config.app}.`,
    version: config.package.version,
    private: false,
    type: 'module',
    sideEffects: false,
    files,
    exports,
    types: './index.d.ts',
  };

  if (config.package.repository) {
    packageJson.repository = {
      type: 'git',
      url: config.package.repository,
    };
  }

  if (config.registry) {
    packageJson.publishConfig = {
      access: 'public',
      registry: config.registry.url,
    };
  }

  return packageJson;
}

/** Generates index declaration that re-exports contract types and emitted runtime values. */
function generateIndexDts(contracts: string[], emittedContracts: string[]): string {
  const typeExports = contracts.map((contract) => `export type * from './${contract}';`).join('\n');
  const runtimeExports = emittedContracts.map((contract) => `export * from './${contract}';`).join('\n');
  return [typeExports, runtimeExports].filter(Boolean).join('\n');
}

/** Generates index runtime module that re-exports emitted contract values. */
function generateIndexJs(emittedContracts: string[]): string {
  if (emittedContracts.length === 0) {
    return generateStubJs();
  }

  return emittedContracts.map((contract) => `export * from './${contract}.js';`).join('\n');
}

/** Minimal runtime stub for package JS files. */
function generateStubJs(): string {
  return 'export {};';
}

/** Returns configured contracts that already have generated .d.ts files. */
export async function collectExistingGeneratedContracts(
  config: Config,
  onMissing: (contractName: string) => void,
  onMissingEmitted: (contractName: string) => void
): Promise<string[]> {
  // 1) Scan generated folder and keep only contracts that have compiled declarations.
  // 2) Report missing contracts via callback so caller can show warnings.
  const generatedDir = getGeneratedDirPath();
  const existing: string[] = [];

  for (const contract of config.contracts) {
    const contractFileName = `${config.app}.contract.${contract}.d.ts`;
    const contractFilePath = path.join(generatedDir, contractFileName);

    try {
      if (await fs.pathExists(contractFilePath)) {
        existing.push(contract);
      } else {
        onMissing(contract);
      }

      if (config.emit.includes(contract)) {
        const runtimeFilePath = path.join(generatedDir, `${config.app}.contract.${contract}.js`);
        if (!(await fs.pathExists(runtimeFilePath))) {
          onMissingEmitted(contract);
        }
      }
    } catch {
      onMissing(contract);
    }
  }

  return existing;
}

/** Recreates package directory and writes declarations/stubs/package.json. */
export async function writePreparedArtifacts(
  config: Config,
  packageDir: string,
  contracts: string[],
  emittedContracts: string[]
): Promise<{ packageJsonPath: string; baseVersion: string }> {
  // 1) Start from a clean output directory.
  const generatedDir = getGeneratedDirPath();

  await fs.remove(packageDir);
  await fs.ensureDir(packageDir);

  // 2) Copy generated declarations into package root with short names.
  for (const contract of contracts) {
    const sourceFile = path.join(generatedDir, `${config.app}.contract.${contract}.d.ts`);
    const destFile = path.join(packageDir, `${contract}.d.ts`);
    const content = await fs.readFile(sourceFile, 'utf-8');
    await fs.writeFile(destFile, content);
  }

  // 3) Write aggregate type entrypoint.
  await fs.writeFile(path.join(packageDir, 'index.d.ts'), generateIndexDts(contracts, emittedContracts));

  // 4) Write runtime entrypoint and contract JS files required by package exports map.
  const jsStub = generateStubJs();
  await fs.writeFile(path.join(packageDir, 'index.js'), generateIndexJs(emittedContracts));
  for (const contract of contracts) {
    if (emittedContracts.includes(contract)) {
      const sourceFile = path.join(generatedDir, `${config.app}.contract.${contract}.js`);
      const destFile = path.join(packageDir, `${contract}.js`);
      const content = await fs.readFile(sourceFile, 'utf-8');
      await fs.writeFile(destFile, content);
    } else {
      await fs.writeFile(path.join(packageDir, `${contract}.js`), jsStub);
    }
  }

  // 5) Generate package metadata and return key values for next steps.
  const packageJson = generatePackageJson(config, contracts);
  const packageJsonPath = path.join(packageDir, 'package.json');
  await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });

  return { packageJsonPath, baseVersion: String(packageJson.version) };
}

/** Updates the version field in prepared package.json. */
export async function updatePackageVersion(packageJsonPath: string, newVersion: string): Promise<void> {
  // Read-modify-write keeps existing package fields untouched.
  const packageJson = (await fs.readJSON(packageJsonPath)) as PackageJsonWithVersion;
  packageJson.version = newVersion;
  await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
}
