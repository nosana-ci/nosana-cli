import { JobStateData, JobState, JOB_STATE_NAME } from "./types.js";
import { StateManager } from "../StateManager.js";

export class JobStateManager extends StateManager<JobState, JobStateData> {
    constructor() {
        super(JOB_STATE_NAME.NONE, {}, 'nodeStateChange');
    }
}
