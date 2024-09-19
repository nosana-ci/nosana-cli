import { JobStateManager } from './manager.js';

export const getJobStateManager = (() => {
  let instance: JobStateManager | null = null;

  return () => {
    if (!instance) {
      instance = new JobStateManager();
    }
    return instance;
  };
})();
