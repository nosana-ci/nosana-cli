import { JobStateManager } from "./manager";

export const getJobStateManager = (() => {
    let instance: JobStateManager | null = null;
  
    return () => {
      if (!instance) {
        instance = new JobStateManager();
      }
      return instance;
    };
})();
