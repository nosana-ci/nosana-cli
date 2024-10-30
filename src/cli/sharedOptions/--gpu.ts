import chalk from 'chalk';
import { InvalidOptionArgumentError, Option } from 'commander';

function validateGPUOption(value: string) {
  console.warn(
    chalk.yellow(
      'Setting GPU device, please ensure your nvidia-ctk is correctly configured to generate using device index naming strategy to avoid errors.',
    ),
  );
  if (!value.match(new RegExp(/^\d+(,\d+)*$/)) && value !== 'all') {
    throw new InvalidOptionArgumentError(
      'Expected a comma seperated number list or "all"',
    );
  }

  return value;
}

export const gpuOption = new Option('--gpu <gpus>', 'set gpu devices')
  .argParser(validateGPUOption)
  .default('all');
