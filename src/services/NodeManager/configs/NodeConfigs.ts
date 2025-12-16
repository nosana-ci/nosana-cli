import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export class NodeConfigs {
  private options: { [key: string]: any };

  constructor(options: { [key: string]: any }) {
    this.options = options;
  }

  loadVariablesToEnv() {
    const network = this.options.network ? this.options.network : 'mainnet';
    const env = network === 'mainnet' ? 'prd' : 'dev';

    const modulePath = dirname(fileURLToPath(import.meta.url));

    // Load .env.${env} first (higher priority)
    dotenv.config({
      path: [
        resolve(modulePath, `../../../../.env.${env}`),
        resolve(modulePath, `../../../../.env`),
      ],
    });

    // System env vars have highest priority (never overwritten due to default override: false)
  }
}

export class NodeConfigsSingleton {
  private static instance: NodeConfigs | null = null;

  private constructor() {}

  static getInstance(options?: { [key: string]: any }): NodeConfigs {
    if (!NodeConfigsSingleton.instance) {
      NodeConfigsSingleton.instance = new NodeConfigs(options || {});
      NodeConfigsSingleton.instance.loadVariablesToEnv();
    }
    return NodeConfigsSingleton.instance;
  }
}
