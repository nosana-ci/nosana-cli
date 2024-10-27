export function convertFromBytes(
  bytes: number,
  toFormat?: 'gb' | 'mb' | 'kb',
): { value: number; format: 'gb' | 'mb' | 'kb' } {
  let value = bytes / 1024;

  if ((value < 1024 && !toFormat) || toFormat === 'kb') {
    return { value: Number(value.toFixed(2)), format: 'kb' };
  }

  value = value / 1024;

  if ((value < 1024 && !toFormat) || toFormat === 'mb') {
    return { value: Number(value.toFixed(2)), format: 'mb' };
  }

  return { value: Number((value / 1024).toFixed(2)), format: 'gb' };
}
