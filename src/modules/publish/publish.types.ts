/** Basic shape of package metadata needed for publish flow. */
export interface PackageJsonInfo {
  name: string;
  version?: string;
}

/** NPM-compatible registry target used by package inspection and publication. */
export interface PackageRegistry {
  url: string;
}

/** Resolved package registry token and where it came from. */
export interface ResolvedRegistryToken {
  source: string;
  token: string;
}
