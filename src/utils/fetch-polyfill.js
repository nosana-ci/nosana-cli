if (!globalThis.fetch) {
  const nodeFetch = (await import(`node-fetch`));
  globalThis.fetch = nodeFetch.default;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}