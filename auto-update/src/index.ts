import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import ora from 'ora';

type SpawnParameters = Parameters<typeof spawn>;

async function installNosanaCLI(version?: string) {
  await execSync(`npm install -g @nosana/cli${version ? '@' + version : ''}`);
}

async function nosanaCLIRunner() {
  let errorCode;
  const version: string | undefined = process.env.CLI_VERSION;
  const spinner = ora(chalk.cyan('Installing @nosana/cli')).start();
  await installNosanaCLI(version);
  spinner.stop();

  while (errorCode === undefined || errorCode === 129) {
    if (errorCode === 129) {
      if (!version) {
        console.log(chalk.yellow('New @nosana/cli version found.'));
        const spinner = ora(chalk.cyan('Updating @nosana/cli')).start();
        await installNosanaCLI();
        spinner.stop();
      } else {
        throw new Error(
          chalk.red(`Need newer @nosana/cli version, but pinned to ${version}`),
        );
      }
    }
    console.log(chalk.green('Starting Nosana CLI'));
    const code = await spawnPromise('nosana', process.argv.slice(2), {
      cwd: process.cwd(),
      detached: true,
      stdio: 'inherit',
    });

    errorCode = code;
  }
}

function spawnPromise(
  arg1: SpawnParameters[0],
  arg2: SpawnParameters[1],
  options: SpawnParameters[2],
) {
  return new Promise((resolve) => {
    const child = spawn(arg1, arg2, options);

    child.on('exit', (code) => resolve(code));
  });
}

await nosanaCLIRunner();
