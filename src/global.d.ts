/// <reference types="vitest/globals" />

declare global {
  interface Error {
    eventType?: string;
  }
}

export {};
