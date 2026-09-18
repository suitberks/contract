import { executeCommandWithResult } from '@/utilities/execution.utilities';

import { getPublishFailureMessage } from './publish.errors';
import type { PackageRegistry } from './publish.types';

/** Returns true when the exact package version is already published in the selected registry. */
export async function versionExistsInRegistry(
  packageName: string,
  version: string,
  registry: PackageRegistry,
  packageDirectory: string
): Promise<boolean> {
  const checkResult = await executeCommandWithResult(
    'npm',
    ['view', `${packageName}@${version}`, '--registry', registry.url],
    packageDirectory
  );

  if (checkResult.success) return true;

  const output = checkResult.stderr || checkResult.stdout || checkResult.errorMessage || 'Unknown registry error';
  const normalizedOutput = output.toLowerCase();
  const isMissingVersion = normalizedOutput.includes('e404') || normalizedOutput.includes('not found');

  if (isMissingVersion) return false;

  throw new Error(getPublishFailureMessage(output));
}

/** Throws when the selected registry already contains the requested package version. */
export async function assertVersionAvailable(
  packageName: string,
  version: string,
  registry: PackageRegistry,
  packageDirectory: string
): Promise<void> {
  const exists = await versionExistsInRegistry(packageName, version, registry, packageDirectory);

  if (exists) {
    throw new Error(
      `Version ${version} already exists in ${registry.url}. Cannot publish duplicate version.\n` +
        `Run "contract prepare:package --bump patch" to bump the version, then try publishing again.`
    );
  }
}
