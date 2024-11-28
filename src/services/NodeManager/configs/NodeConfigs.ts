import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export class NodeConfigs {
    constructor() {}
  
    static loadVariablesToEnv(options: { [key: string]: any }) {
      const env = options.network === 'mainnet' ? 'production' : 'dev';
  
      const modulePath = dirname(fileURLToPath(import.meta.url));
  
      dotenv.config({
        path: resolve(modulePath, `../../../../.env.${env}`),
        override: true,
      });
    }
  }
  