import { Response } from 'express';
import { TaskManagerRegistry } from '../../../task/TaskManagerRegistry.js';
import { NodeAPIRequest } from '../../types/index.js';

/**
 * Returns all operation statuses for the job.
 */
export function getOperationsStatusHandler(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const { jobId } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  return res.status(200).json(task.getOperationsStatus());
}

/**
 * Returns the status of a specific operation.
 */
export function getOperationStatusHandler(
  req: NodeAPIRequest<{ jobId: string; opId: string }>,
  res: Response,
) {
  const { jobId, opId } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  return res.status(200).json(task.getOperationStatus(opId));
}

/**
 * Returns the status of all operations in the current group.
 */
export function getCurrentGroupStatusHandler(
  req: NodeAPIRequest<{ jobId: string }>,
  res: Response,
) {
  const { jobId } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  return res.status(200).json(task.getCurrentGroupStatus());
}

/**
 * Returns the status of all operations in a specified group.
 */
export function getGroupStatusHandler(
  req: NodeAPIRequest<{ jobId: string; group: string }>,
  res: Response,
) {
  const { jobId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  return res.status(200).json(task.getGroupStatus(group));
}
