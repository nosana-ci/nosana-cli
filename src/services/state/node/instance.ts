import { NodeStateManager } from "./manager";

export const getNodeStateManager = (() => {
    let instance: NodeStateManager | null = null;
  
    return () => {
      if (!instance) {
        instance = new NodeStateManager();
      }
      return instance;
    };
})();