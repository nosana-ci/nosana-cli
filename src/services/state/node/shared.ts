import { getNodeStateManager } from './instance.js';

export const shared = (name: string) => {
  const stateManager = getNodeStateManager();
  return stateManager.getSharedData(name);
};

export const sharedObj = (...keys: string[]) => {
  const stateManager = getNodeStateManager();
  return stateManager.getSharedDataObj(...keys);
};
