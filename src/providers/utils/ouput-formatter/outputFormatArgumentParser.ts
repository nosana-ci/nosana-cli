export const outputFormatArgumentParser = (args: string[]) => {
  if (args.includes('--verbose')) {
    return 'verbose:text';
  }

  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && formatIndex + 1 < args.length) {
    return args[formatIndex + 1];
  }

  return 'text';
};
