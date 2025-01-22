import 'rpc-websockets/dist/lib/client.js';
import { validateCLIVersion } from '../../../services/versions.js';
import NodeManager from '../../../services/NodeManager/index.js';

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
): Promise<void> {
  const nodeManager = new NodeManager(options);

  while (true) {
    try {
      await validateCLIVersion();

      await nodeManager.init();
      await nodeManager.start(market);
    } catch (error: any) {
      const formattedError = `
      ========== ERROR ==========
      Timestamp: ${new Date().toISOString()}
      Error Name: ${error.name || 'Unknown Error'}
      Message: ${error.message || 'No message available'}
      Trace: ${error.stack ?? error.trace}
      ============================
      `;

      console.error(formattedError);

      await nodeManager.error();

      if (nodeManager.inJobLoop) {
        try {
          await nodeManager.clean();
        } catch (error) {}

        await nodeManager.delay(60);
        continue;
      } else {
        await nodeManager.stop();
        process.exit();
      }
    }
  }
}
