import { getJobStateManager } from './instance.js';

export const shared = (name: string) => {
  const stateManager = getJobStateManager();
  return stateManager.getSharedData(name);
};

export const sharedObj = (...keys: string[]) => {
  const stateManager = getJobStateManager();
  return stateManager.getSharedDataObj(...keys);
};
