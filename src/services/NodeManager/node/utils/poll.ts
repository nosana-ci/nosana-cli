import { Run } from '@nosana/sdk';

export function pollForRun(getRun: () => Run | undefined, interval = 200) {
  let poll: NodeJS.Timeout;
  let cancelled = false;

  const promise = new Promise((resolve) => {
    poll = setInterval(() => {
      if (cancelled) return;

      try {
        const run = getRun();
        if (run) {
          clearInterval(poll);
          resolve(run);
        }
      } catch {}
    }, interval);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      clearInterval(poll);
    },
  };
}
