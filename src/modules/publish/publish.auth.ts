import fs from 'fs-extra';

import type { getConfig } from '@/environment/environment.services';

import { DEFAULT_PACKAGE_REGISTRY_URL } from './publish.constants';
import type { PackageRegistry, ResolvedRegistryToken } from './publish.types';

import path from 'path';

/** Resolves the configured package registry or the backward-compatible npmjs default. */
export function resolvePackageRegistry(config: Awaited<ReturnType<typeof getConfig>>): PackageRegistry {
  return { url: config.registry?.url ?? DEFAULT_PACKAGE_REGISTRY_URL };
}

/** Picks package registry authentication from config before supported environment fallbacks. */
export function resolveRegistryToken(config: Awaited<ReturnType<typeof getConfig>>): ResolvedRegistryToken | null {
  if (config.registry?.token) return { source: 'config', token: config.registry.token };
  if (process.env.PACKAGE_REGISTRY_TOKEN) {
    return { source: 'PACKAGE_REGISTRY_TOKEN', token: process.env.PACKAGE_REGISTRY_TOKEN };
  }
  if (process.env.NODE_AUTH_TOKEN) return { source: 'NODE_AUTH_TOKEN', token: process.env.NODE_AUTH_TOKEN };
  if (process.env.NPM_TOKEN) return { source: 'NPM_TOKEN', token: process.env.NPM_TOKEN };

  return null;
}

/** Writes temporary npm-compatible registry authentication into the prepared package directory. */
export async function writeRegistryConfig(
  packageDir: string,
  packageName: string,
  registry: PackageRegistry,
  token: string
): Promise<void> {
  const registryUrl = new URL(registry.url);
  const normalizedRegistryUrl = `${registryUrl.origin}${registryUrl.pathname.replace(/\/$/, '')}`;
  const authPath = registryUrl.pathname.replace(/^\//, '').replace(/\/$/, '');
  const authKey = authPath.length > 0 ? `//${registryUrl.host}/${authPath}/` : `//${registryUrl.host}/`;
  const packageScope = packageName.startsWith('@') ? packageName.split('/')[0] : null;
  const npmrcPath = path.join(packageDir, '.npmrc');
  const scopeConfig = packageScope ? `${packageScope}:registry=${normalizedRegistryUrl}\n` : '';

  await fs.writeFile(npmrcPath, `registry=${normalizedRegistryUrl}\n${scopeConfig}${authKey}:_authToken=${token}\n`);
}

/** Removes temporary package registry authentication after every publication attempt. */
export async function removeRegistryConfig(packageDir: string): Promise<void> {
  const npmrcPath = path.join(packageDir, '.npmrc');
  await fs.remove(npmrcPath);
}
