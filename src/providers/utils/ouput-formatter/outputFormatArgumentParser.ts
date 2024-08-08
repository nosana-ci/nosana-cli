export const outputFormatArgumentParser = (args: string[]) => {
  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && formatIndex + 1 < args.length) {
    return args[formatIndex + 1];
  }
  return '';
};
