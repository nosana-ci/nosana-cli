export type configType = {
  backendUrl: string;
  backendSolanaAddress: string;
  signMessage: string;
  frp: {
    serverAddr: string;
    serverPort: number;
  };
  minDiskSpace: number;
};
export const getConfig = async (): Promise<configType> => {
  try {
    return (
      (await import(
        `./config/${
          process.env.APP_ENV || process.env.NODE_ENV || 'production'
        }.ts`
      )) as { config: configType }
    ).config;
  } catch (err) {
    throw err;
  }
};
