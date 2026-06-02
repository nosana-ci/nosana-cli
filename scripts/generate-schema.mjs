// Generates src/api/schema.d.ts from the OpenAPI specs of the three services
// that replaced the old monolithic dashboard API. Each service exposes its own
// swagger; we fetch them all, merge into a single OpenAPI document, and feed
// that to openapi-typescript.
//
// Usage: node scripts/generate-schema.mjs [env]
//   env = prd | dev | local   (default: prd)

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../src/api/schema.d.ts');

// Each env lists the swagger endpoints of every backing service.
const ENVS = {
  prd: [
    'https://blockchain-indexer.k8s.prd.nos.ci/swagger/json',
    'https://client-manager.k8s.prd.nos.ci/swagger/json',
    'https://host-manager.k8s.prd.nos.ci/swagger/json',
  ],
  dev: [
    'https://blockchain-indexer.k8s.dev.nos.ci/swagger/json',
    'https://client-manager.k8s.dev.nos.ci/swagger/json',
    'https://host-manager.k8s.dev.nos.ci/swagger/json',
  ],
  local: [
    'http://localhost:3001/swagger/json',
    'http://localhost:3002/swagger/json',
    'http://localhost:3003/swagger/json',
  ],
};

const env = process.argv[2] ?? 'prd';
const urls = ENVS[env];
if (!urls) {
  console.error(`Unknown env "${env}". Expected one of: ${Object.keys(ENVS).join(', ')}`);
  process.exit(1);
}

async function fetchSpec(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return res.json();
}

console.log(`Fetching ${urls.length} specs for env "${env}"...`);
const specs = await Promise.all(urls.map(fetchSpec));

// Merge into a single OpenAPI document. Paths and component schemas are unioned;
// collisions are reported loudly so we never silently clobber a definition.
const merged = {
  openapi: '3.0.3',
  info: { title: 'Nosana API (merged)', version: '0.0.0' },
  paths: {},
  components: { schemas: {}, securitySchemes: {} },
};

const seen = { paths: new Map(), schemas: new Map(), securitySchemes: new Map() };

function mergeSection(targetObj, sourceObj, kind, sourceUrl) {
  for (const [key, value] of Object.entries(sourceObj ?? {})) {
    const prior = seen[kind].get(key);
    if (prior && JSON.stringify(prior.value) !== JSON.stringify(value)) {
      console.warn(
        `⚠️  ${kind} collision on "${key}": defined differently in ${prior.url} and ${sourceUrl}. Keeping the latter.`
      );
    }
    seen[kind].set(key, { value, url: sourceUrl });
    targetObj[key] = value;
  }
}

specs.forEach((spec, i) => {
  mergeSection(merged.paths, spec.paths, 'paths', urls[i]);
  mergeSection(merged.components.schemas, spec.components?.schemas, 'schemas', urls[i]);
  mergeSection(merged.components.securitySchemes, spec.components?.securitySchemes, 'securitySchemes', urls[i]);
});

const ast = await openapiTS(merged);
await writeFile(OUT, astToString(ast));
console.log(`Wrote ${OUT} (${Object.keys(merged.paths).length} paths, ${Object.keys(merged.components.schemas).length} schemas).`);
