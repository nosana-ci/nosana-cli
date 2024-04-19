import { config as dotenvConfig } from 'dotenv';

export const initEnv = () =>
  dotenvConfig({
    path: ['.env', `.env.${process.env.APP_ENV || process.env.NODE_ENV}`],
    override: true,
  });

type EnvType = 'BACKEND_URL' | 'BACKEND_SOLANA_ADDRESS';

class Config {
  public get(name: EnvType) {
    const env = process.env[name];
    if (!env) {
      throw new Error(`Config error. Can't get ${name}.`);
    }
    return env;
  }
}

export const envConfig = new Config();
