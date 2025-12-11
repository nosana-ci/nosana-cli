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
    const env = network === 'mainnet' ? 'production' : 'dev';

    const modulePath = dirname(fileURLToPath(import.meta.url));

    dotenv.config({
      // Setting common config first because override is set to true
      // and that means the last value is taken over others
      path: [
        resolve(modulePath, `../../../../.env`),
        resolve(modulePath, `../../../../.env.${env}`),
      ],
      override: true,
    });
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
