export class NodeAlreadyActiveError extends Error {
  constructor(address: string) {
    super(
      `Node ${address} is already online and active; you cannot start a new one`,
    );
    this.name = 'NodeAlreadyActiveError';
  }
}
