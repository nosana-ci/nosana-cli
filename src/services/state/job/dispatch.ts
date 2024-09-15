import { getJobStateManager } from "./instance.js";
import { JobState, JobStateData } from "./types.js";

export const dispatch = (newState: JobState, data: JobStateData[JobState]) => {
    const stateManager = getJobStateManager();
    stateManager.updateState(newState, data);
}
