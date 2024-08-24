export function createSeverObject(server: string): {
  host: string;
  port: string;
  protocol: 'https' | 'http' | 'ssh';
} {
  const { hostname, port, protocol } = new URL(
    server.startsWith('http') || server.startsWith('ssh')
      ? server
      : `http://${server}`,
  );

  const formattedProtocol = protocol.replace(':', '');

  if (
    !['https', 'http', 'ssh'].includes(formattedProtocol) &&
    typeof protocol !== 'undefined'
  ) {
    throw new Error(`Protocol ${protocol} not supported`);
  }

  return {
    host: hostname,
    port,
    protocol: formattedProtocol as 'https' | 'http' | 'ssh',
  };
}
