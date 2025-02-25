import { NodeAbortController } from './NodeAbortController.js';

export const nodeAbortControllerSelector = (() => {
  let instance: NodeAbortController | null = null;

  return () => {
    if (!instance) {
      instance = new NodeAbortController();
    }
    return instance;
  };
})();

export const abortControllerSelector = () => {
  return nodeAbortControllerSelector().getController();
};
