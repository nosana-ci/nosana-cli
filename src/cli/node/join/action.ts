import chalk from 'chalk';

export async function runBenchmarkOLD(
  options: { [key: string]: any },
  shouldKillProgram = true,
) {
  throw new Error(
    chalk.red('node join is now depericated, please use node start instead'),
  );
}
