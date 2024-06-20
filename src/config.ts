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
export const config: configType = (
  await import(
    `./config/${process.env.APP_ENV || process.env.NODE_ENV || 'production'}.js`
  )
).config;
