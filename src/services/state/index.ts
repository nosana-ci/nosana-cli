import { NodeStateManager } from "./node/NodeStateManager";

export const getNodeStateManager = (() => {
    let instance: NodeStateManager | null = null;
  
    return () => {
      if (!instance) {
        instance = new NodeStateManager();
      }
      return instance;
    };
})();
