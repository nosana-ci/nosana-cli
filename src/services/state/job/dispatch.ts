import { getJobStateManager } from './instance.js';
import { sharedObj } from './shared.js';
import { JobState, JobStateData } from './types.js';

export const dispatch = (newState: JobState, data?: JobStateData[JobState]) => {
  const stateManager = getJobStateManager();

  const sharedData = {
    ...sharedObj('node', 'market', 'ipfs', 'job', 'operation', 'flow'),
    ...data, // Allow additional data to override sharedObj if needed
  };

  stateManager.updateState(newState, sharedData);
};
