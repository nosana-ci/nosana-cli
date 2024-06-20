import { Command, Option } from 'commander';
import { networkOption, rpcOption, walletOption } from '../sharedOptions';
import { runBenchmark } from '../../node';

export const joinTestGridCommand = new Command('join-test-grid')
  .addOption(
    new Option(
      '--provider <provider>',
      'provider used to run the job definition',
    )
      .choices(['docker', 'podman'])
      .default('podman'),
  )
  .addOption(
    new Option(
      '--docker, --podman <URI>',
      'Podman/Docker connection URI',
    ).default('http://localhost:8080'),
  )
  .addOption(walletOption)
  .addOption(networkOption)
  .addOption(rpcOption)
  .addOption(
    new Option(
      '--airdrop',
      'request an airdrop when low on SOL on devnet',
    ).default(true),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'Config path (to store the flows database and other config)',
    ).default('~/.nosana/'),
  )
  .addOption(new Option('--no-airdrop', 'no airdrop on devnet'))
  .description('Join Test Grid Devnet Job')
  .action(runBenchmark);
