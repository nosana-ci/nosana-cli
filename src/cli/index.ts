import { Command } from 'commander';

export async function startCLI(program: Command) {
  try {
    await program.parseAsync(process.argv);
  } catch (e: any) {
    const logLevel: string = program.getOptionValue('log');
    if (logLevel === 'debug') {
      console.error(e.message ? e.message : e);
    } else if (logLevel === 'trace') {
      console.error(e);
    }
    process.exit(1);
  }
}
