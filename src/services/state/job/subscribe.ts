import { getJobStateManager } from "./instance.js";
import { JobState, JobStateData } from "./types.js";

export const subscribe = (callback: (entry: { state: JobState; data: JobStateData[JobState]; timestamp: Date }) => void) => {
    const stateManager = getJobStateManager();
    stateManager.onStateChange(callback);
}
