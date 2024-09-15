import { getNodeStateManager } from "./instance.js";
import { NodeState, NodeStateData } from "./types.js";

export const dispatch = (newState: NodeState, data: NodeStateData[NodeState]) => {
    const stateManager = getNodeStateManager();
    stateManager.updateState(newState, data);
}