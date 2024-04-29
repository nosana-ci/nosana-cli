import { config as dotenvConfig } from 'dotenv';

export const initEnv = () =>
  dotenvConfig({
    path: ['.env', `.env.${process.env.APP_ENV || process.env.NODE_ENV}`],
    override: true,
  });

type EnvType = 'BACKEND_URL' | 'BACKEND_SOLANA_ADDRESS';

class Config {
  public get(name: EnvType) {
    let env = process.env[name];
    if (!env) {
      // TEMP CONFIG FIX
      if (name == 'BACKEND_URL') env = 'https://dashboard.k8s.prd.nos.ci/api';
      if (name == 'BACKEND_SOLANA_ADDRESS')
        env = '7rFPFnxjXHC2sfDy3qrDa9pEb4j49oivMuV7e8sYDPmB';
      if (!env) {
        throw new Error(`Config error. Can't get ${name}.`);
      }
    }
    return env;
  }
}

export const envConfig = new Config();
