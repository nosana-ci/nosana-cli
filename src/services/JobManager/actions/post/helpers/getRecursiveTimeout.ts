import { DEFAULT_OFFSET_SEC } from '../../../definitions/index.js';

export const recurisveTimeout = (
  timeout: number,
  recursive_offset_min?: number,
) =>
  (timeout -
    (recursive_offset_min ? recursive_offset_min * 60 : DEFAULT_OFFSET_SEC)) *
  1000;
