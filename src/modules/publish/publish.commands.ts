import { Command, Option } from 'clipanion';

import { publishContractPackage } from './publish.services';

/** CLI command that publishes a prepared contract package to its configured registry. */
export class PublishPackageCommand extends Command {
  static override paths = [['publish:package']];

  access = Option.String('--access', {
    description: 'Kept for compatibility. Only public access is supported.',
  });

  prepare = Option.Boolean('--prepare', false, {
    description: 'Prepare package before publishing',
  });

  public async execute(): Promise<void> {
    await publishContractPackage({
      access: this.access,
      prepare: this.prepare,
    });
  }
}
