import { log } from '@clack/prompts';
import { green } from 'kleur/colors';

/** Returns spinner text when package publication starts. */
export const publishSpinnerStartedMessage = (packageName: string, version: string, registryUrl: string): string =>
  `Publishing ${packageName}@${version} to ${registryUrl}...`;
/** Returns spinner text when npm publish succeeds. */
export const publishSpinnerCompletedMessage = (packageName: string, version: string): string =>
  `Published ${packageName}@${version}.`;
/** Returns spinner text when npm publish fails. */
export const publishSpinnerFailedMessage = (): string => 'Publish failed.';

/** Logs that prepared package directory is missing. */
export const packageDirectoryNotFoundMessage = (): void =>
  log.error(`Package dir missing. Run ${green('contract prepare:package')}.`);
/** Logs that package metadata file is missing. */
export const packageJsonNotFoundMessage = (): void =>
  log.error(`package.json missing. Run ${green('contract prepare:package')}.`);
/** Logs start of prepare step for publish --prepare flow. */
export const packagePreparationStartedMessage = (): void => log.info('Preparing package...');
/** Logs missing package registry authentication guidance. */
export const registryTokenMissingMessage = (): void =>
  log.error('Registry token missing. Set config.registry.token, PACKAGE_REGISTRY_TOKEN, or NODE_AUTH_TOKEN.');
/** Logs fatal publish command failure details. */
export const fatalErrorWhilePublishingMessage = (error: string): void => log.error(`Publish failed: ${error}`);
