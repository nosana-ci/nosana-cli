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

// TODO: Correct process.env types

export const config: configType = {
  backendUrl: process.env.BACKEND_URL!,
  backendSolanaAddress: process.env.BACKEND_SOLANA_ADDRESS!,
  signMessage: process.env.SIGN_MESSAGE!,
  frp: {
    serverAddr: process.env.FRP_SERVER_ADDRESS!,
    serverPort: parseInt(process.env.FRP_SERVER_PORT!),
  },
  minDiskSpace: parseInt(process.env.MIN_DISK_SPACE!),
};
