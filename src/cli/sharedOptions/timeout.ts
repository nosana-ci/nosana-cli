import { Option } from 'commander';

export const timeoutOption = new Option(
  '-t, --timeout <timeout>',
  'the duration you want to add to the job (in minutes)',
)
  .makeOptionMandatory(true)
  .argParser((value) => {
    const timeout = parseInt(value, 10);
    if (isNaN(timeout) || timeout <= 0) {
      throw new Error(
        'Invalid timeout value. Please provide a positive integer.',
      );
    }

    // Convert minutes to seconds
    const timeoutInSeconds = timeout * 60;

    return timeoutInSeconds;
  });
