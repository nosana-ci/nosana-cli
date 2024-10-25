const reactiveEvents = {
  DELETE: 'DELETE',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
} as const;

export type ReactiveEvent = keyof typeof reactiveEvents;

export class ReactiveState<K extends unknown, T extends unknown> extends Map<
  K,
  T
> {
  private callbacks: Map<K, (event: ReactiveEvent, value: T) => void>;

  constructor(iterable?: Iterable<readonly [K, T]> | null | undefined) {
    super(iterable);
    this.callbacks = new Map<K, (event: ReactiveEvent, value: T) => void>();
  }

  private broadcast(key: K, event: ReactiveEvent, value: T) {
    const callback = this.callbacks.get(key);

    if (callback) {
      callback(event, value);
    }
  }

  list(): T[] {
    return [...this.values()];
  }

  delete(key: K): boolean {
    const value = this.get(key);

    if (value) {
      super.delete(key);
      this.broadcast(key, 'DELETE', value);
      return true;
    }

    return false;
  }

  set(key: K, value: T): this {
    const exists = this.has(key);

    super.set(key, value);

    this.broadcast(key, exists ? 'UPDATE' : 'CREATE', value);

    return this;
  }

  addListener(
    key: K,
    callback: (event: ReactiveEvent, value: T) => void,
  ): void {
    this.callbacks.set(key, callback);
  }

  removeListener(key: K): void {
    this.callbacks.delete(key);
  }
}
