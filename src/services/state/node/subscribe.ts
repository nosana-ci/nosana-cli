import { getNodeStateManager } from "./instance.js";
import { NodeState, NodeStateData } from "./types.js";

export const subscribe = (callback: (entry: { state: NodeState; data: NodeStateData[NodeState]; timestamp: Date }) => void) => {
    const stateManager = getNodeStateManager();
    stateManager.onStateChange(callback);
}
