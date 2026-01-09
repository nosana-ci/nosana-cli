import WebSocket from 'ws';
import { logStreaming } from '../../../../monitoring/streaming/LogStreamer.js';
import { getSDK } from '../../../../../sdk.js';
import { TaskManagerRegistry } from '../../../task/TaskManagerRegistry.js';
import { TaskLog } from '../../../task/TaskManager.js';

/**
 * this is for log streaming, this is going to be used by the basic job poster
 * just to show that clients logs, both from the node and the container
 */
export async function wssLogRoute(
  ws: WebSocket,
  _: string,
  { jobAddress }: { jobAddress: string },
) {
  const sdk = getSDK();
  const walletAddress = sdk.solana.wallet.toString();

  logStreaming(walletAddress).subscribe(ws, jobAddress);
}

export function wssTaskManagerLogRoute(
  ws: WebSocket,
  _: string,
  {
    jobAddress,
    group,
    opId,
    type,
  }: {
    jobAddress: string;
    group?: string;
    opId?: string;
    type?: string;
  },
) {
  const task = TaskManagerRegistry.getInstance().get(jobAddress);
  if (!task) return ws.close(1008, 'Invalid job address');

  task.subscribe(ws, (log: TaskLog) => {
    return (
      (!group || log.group === group) &&
      (!opId || log.opId === opId) &&
      (!type || log.type === type)
    );
  });

  // // Send historical logs first (optional)
  // const logs = opId
  //   ? task.getLogsByOp(opId)
  //   : group
  //   ? task.getLogsByGroup(group)
  //   : task.getAllLogs();

  // for (const log of logs) {
  //   try {
  //     ws.send(JSON.stringify({ path: 'flog', data: JSON.stringify(log) }));
  //   } catch {}
  // }
}
