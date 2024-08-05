export const OUTPUT_EVENTS = {
  EXAMPLE_OUTPUT: 'EXAMPLE_OUTPUT',
} as const;

export type OutputEvent = (typeof OUTPUT_EVENTS)[keyof typeof OUTPUT_EVENTS];
