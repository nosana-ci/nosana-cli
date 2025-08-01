import { StopReasons } from '../../../task/TaskManager.js';
import { TaskManagerRegistry } from '../../../task/TaskManagerRegistry.js';
import { NodeAPIRequest } from '../../types/index.js';
import { Response } from 'express';

export async function restartOperationHandler(
  req: NodeAPIRequest<{ jobId: string, opId: string, group: string }>,
  res: Response,
) {
  const { jobId, opId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }
console.log("I CAME AND TRIED TO RESTARt")
  try {
    await task.restartTaskManagerOperation(group, opId);
    return res.status(200).json({ message: 'Operation restarted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to restart operation' });
  }
}

export async function restartGroupOperationHandler(
  req: NodeAPIRequest<{ jobId: string, group: string }>,
  res: Response,
) {
  const { jobId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  try {
    await task.restartTaskManagerGroupOperations(group);
    return res.status(200).json({ message: 'Group Operation restarted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to restart group operations' });
  }
}

export async function moveGroupOperationHandler(
  req: NodeAPIRequest<{ jobId: string, group: string }>,
  res: Response,
) {
  const { jobId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  try {
    await task.moveTaskManagerGroupOperations(group);
    return res.status(200).json({ message: 'Group Operation restarted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to restart group operations' });
  }
}

export async function stopOperationHandler(
  req: NodeAPIRequest<{ jobId: string, opId: string, group: string }>,
  res: Response,
) {
  const { jobId, opId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  try {
    await task.stopTaskManagerOperation(group, opId);
    return res.status(200).json({ message: 'Operation Stopped' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to Stop operation' });
  }
}

export async function stopGroupOperationHandler(
  req: NodeAPIRequest<{ jobId: string, group: string }>,
  res: Response,
) {
  const { jobId, group } = req.params;
  const task = TaskManagerRegistry.getInstance().get(jobId);

  if (!task) {
    return res.status(400).send('invalid job id');
  }

  try {
    await task.stopTaskManagerGroupOperations(group);
    return res.status(200).json({ message: 'Group Operation Stopped' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to stop group operations' });
  }
}
