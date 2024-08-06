import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import ora from 'ora';

type SpawnParameters = Parameters<typeof spawn>;

console.log(process.argv.slice(2));

async function nosanaCLIRunner() {
  let errorCode;

  while (errorCode === undefined || errorCode === 129) {
    if (errorCode === 129) {
      console.log(chalk.yellow('New @nosana/cli version found.'));
      const spinner = ora(chalk.cyan('Updating @nosana/cli')).start();
      await execSync('npm install -g @nosana/cli');
      spinner.stop();

      console.log(chalk.green('Starting Nosana CLI'));
    }

    const code = await spawnPromise('nosana', process.argv.slice(2), {
      cwd: process.cwd(),
      detached: true,
      stdio: 'inherit',
    });

    console.log({ code });

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
