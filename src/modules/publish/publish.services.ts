import { spinner } from '@clack/prompts';

import { getConfig, handleEnvironment } from '@/environment/environment.services';
import { prepareContractPackage } from '@/modules/prepare/prepare.services';
import { executeCommandWithResult } from '@/utilities/execution.utilities';

import {
  removeRegistryConfig,
  resolvePackageRegistry,
  resolveRegistryToken,
  writeRegistryConfig,
} from './publish.auth';
import { getPublishFailureMessage } from './publish.errors';
import {
  fatalErrorWhilePublishingMessage,
  packageDirectoryNotFoundMessage,
  packageJsonNotFoundMessage,
  packagePreparationStartedMessage,
  publishSpinnerCompletedMessage,
  publishSpinnerFailedMessage,
  publishSpinnerStartedMessage,
  registryTokenMissingMessage,
} from './publish.messages';
import { assertVersionAvailable } from './publish.registry';
import {
  ensurePublishPathsExist,
  readPackageJsonInfo,
  resolvePublishPaths,
  syncPackageJsonVersion,
} from './publish.validation';

/** Publishes prepared contract package artifacts to the configured npm-compatible registry. */
export async function publishContractPackage(options: { access?: string; prepare?: boolean } = {}): Promise<void> {
  let packageDirForCleanup: string | null = null;
  let publishSpinner: ReturnType<typeof spinner> | null = null;

  try {
    // Step 1: Load config.
    let config = await getConfig();

    // Step 2: Optionally prepare package artifacts before publish.
    if (options.prepare) {
      packagePreparationStartedMessage();
      await handleEnvironment(config);
      await prepareContractPackage(config);

      // Re-read config because prepare can bump and persist package.version.
      config = await getConfig();
    }

    // Step 3: Resolve and validate package paths/metadata.
    const paths = resolvePublishPaths();
    packageDirForCleanup = paths.packageDir;

    try {
      await ensurePublishPathsExist(paths);
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      if (code === 'PACKAGE_DIR_NOT_FOUND') {
        packageDirectoryNotFoundMessage();
        process.exitCode = 1;
        return;
      }

      if (code === 'PACKAGE_JSON_NOT_FOUND') {
        packageJsonNotFoundMessage();
        process.exitCode = 1;
        return;
      }

      throw error;
    }

    const packageJson = await readPackageJsonInfo(paths.packageJsonPath);
    const packageName = packageJson.name;
    const registry = resolvePackageRegistry(config);

    // Step 4: Resolve registry authentication before any remote registry operation.
    const registryToken = resolveRegistryToken(config);
    if (!registryToken) {
      registryTokenMissingMessage();
      process.exitCode = 1;
      return;
    }

    await writeRegistryConfig(paths.packageDir, packageName, registry, registryToken.token);

    // Step 5: Enforce config version as source-of-truth for the selected registry.
    const packageVersion = config.package.version;
    await assertVersionAvailable(packageName, packageVersion, registry, paths.packageDir);
    await syncPackageJsonVersion(paths.packageJsonPath, packageJson, packageVersion);

    // Step 6: Show compact publish progress after every preflight check succeeds.
    publishSpinner = spinner();
    publishSpinner.start(publishSpinnerStartedMessage(packageName, packageVersion, registry.url));

    // Step 7: Validate CLI options and execute package publication.
    if (options.access && options.access !== 'public') {
      throw new Error('Only --access public is supported for contract publish:package.');
    }

    const publishResult = await executeCommandWithResult(
      'npm',
      ['publish', '--access', 'public', '--registry', registry.url],
      paths.packageDir
    );

    // Step 8: Treat only non-zero exit as failure; npm notice in stderr is allowed.
    if (!publishResult.success) {
      const errorOutput = publishResult.stderr || publishResult.stdout || publishResult.errorMessage || 'Unknown error';
      throw new Error(getPublishFailureMessage(errorOutput));
    }

    // Step 9: Report success in the same progress line.
    publishSpinner.stop(publishSpinnerCompletedMessage(packageName, packageVersion));
  } catch (error) {
    if (publishSpinner) {
      publishSpinner.stop(publishSpinnerFailedMessage());
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    fatalErrorWhilePublishingMessage(errorMessage);
    process.exitCode = 1;
  } finally {
    if (packageDirForCleanup) {
      await removeRegistryConfig(packageDirForCleanup);
    }
  }
}
