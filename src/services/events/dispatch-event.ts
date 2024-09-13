import { BaseNodeEvent, NodeEvent } from "./event";
import { NodeState, StatusNames, StatusName } from "./state";

export const getCurrentNodeState = (() => {
    let instance: NodeState | null = null;
  
    return () => {
      if (!instance) {
        const now = new Date();
        instance = new NodeState({ status: { name: StatusNames.NONE, start: now }, createdAt: now });
      }
      return instance;
    };
})();

export const getCurrentNodeEvent = (() => {
    let instance: NodeEvent | null = null;
  
    return () => {
      if (!instance) {
        instance = new NodeEvent();
      }
      return instance;
    };
})();

export const dispatch = (newStatusName: StatusName, eventType: string, additionalInfo: Partial<BaseNodeEvent> = {}): void => {
    const nodeState = getCurrentNodeState();
    const nodeEvent = getCurrentNodeEvent();

    // End the current status (setting stop time)
    nodeState.endCurrentStatus();

    // Update the state with the new status
    nodeState.updateStatus(newStatusName);

    // Create the event with the new state and additional info
    const event: BaseNodeEvent = {
        type: eventType,
        state: nodeState.getState(),
    };

    // Add the event to the event handler
    nodeEvent.addEvent(event);
};
