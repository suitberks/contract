import { z } from 'zod';

/** Strongly-typed contract config accepted by the project. */
export interface Config {
  app: string;
  contracts: string[];
  emit: string[];
  package: {
    name: string;
    version: string;
    repository?: string;
    exports?: Record<string, string>;
  };
  registry?: {
    url: string;
    token?: string;
  };
}

/** Runtime schema for project contract configuration. */
export const ConfigSchema: z.ZodType<Config> = z
  .object({
    app: z
      .string()
      .regex(/^[a-zA-Z_-]+$/)
      .default('placeholder')
      .meta({ description: 'The name of the application, used in filenames and identifiers.' }),
    contracts: z
      .array(z.string().regex(/^[a-zA-Z_-]+$/))
      .default([])
      .meta({ description: 'Array of selected contract names.' }),
    emit: z
      .array(z.string().regex(/^[a-zA-Z_-]+$/))
      .default([])
      .meta({ description: 'Subset of contracts that should also emit runtime JavaScript artifacts.' }),
    package: z
      .object({
        name: z.string().meta({ description: 'Scoped package name, e.g. @scope/package-name' }),
        version: z
          .string()
          .regex(/^\d+\.\d+\.\d+/)
          .meta({ description: 'Semantic version, e.g. 1.0.0' }),
        repository: z
          .url()
          .optional()
          .meta({ description: 'Optional source repository associated with the published package.' }),
        exports: z
          .record(z.string(), z.string())
          .optional()
          .meta({ description: 'Optional package exports configuration.' }),
      })
      .meta({ description: 'Package metadata for contract distribution.' }),
    registry: z
      .object({
        url: z.url().meta({ description: 'NPM-compatible registry URL used for package publication.' }),
        token: z.string().optional().meta({ description: 'Optional registry token used for package publication.' }),
      })
      .optional()
      .meta({ description: 'Optional package registry configuration.' }),
  })
  .superRefine((config, context) => {
    const contractNames = new Set(config.contracts);

    for (const contract of config.emit) {
      if (!contractNames.has(contract)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['emit'],
          message: `Emitted contract "${contract}" must be listed in contracts.`,
        });
      }
    }
  });

/** Runtime schema describing expected filesystem environment state. */
export const EnvironmentStatusSchema = z.object({
  contractDirectoryExists: z
    .boolean()
    .default(false)
    .meta({ description: 'Indicates if the main contract directory exists.' }),
  directoriesExistence: z
    .object({
      // * Ensure keys match ENVIRONMENT_DIRECTORIES
      manifests: z.boolean(), // Folder where contract manifests are stored
      generated: z.boolean(), // Folder for generated contract d.ts files
    })
    .default({ manifests: false, generated: false })
    .meta({ description: 'Existence status of required environment directories.' }),
  manifestsExistence: z
    .record(z.string(), z.boolean()) // Cannot use config here directly, so using string keys
    .default({})
    .meta({ description: 'Existence status of required contract manifest files (contract.<contract>.manifest.ts).' }),
});
/** Strongly-typed environment status derived from EnvironmentStatusSchema. */
export type EnvironmentStatus = z.infer<typeof EnvironmentStatusSchema>;
