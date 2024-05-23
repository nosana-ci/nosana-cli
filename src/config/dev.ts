export const config = {
  backendUrl:
    process?.env?.SOLANA_NETWORK || 'https://dashboard.k8s.dev.nos.ci/api',
  backendSolanaAddress:
    process?.env?.BACKEND_SOLANA_ADDRESS ||
    '7rFPFnxjXHC2sfDy3qrDa9pEb4j49oivMuV7e8sYDPmB',
  signMessage: process?.env?.SIGN_MESSAGE || 'Hello Nosana Node!',
};
