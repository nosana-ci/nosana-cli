import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JobDefinition } from '../providers/Provider';

const customDirname = path.dirname(fileURLToPath(import.meta.url));

function readJsonFileSync<T extends unknown>(filePath: string): T {
  const absolutePath = path.resolve(customDirname, filePath);
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(fileContent) as T;
}

const pkg = readJsonFileSync<{ version: string }>('../../package.json');
const benchmarkGPU = readJsonFileSync<JobDefinition>('./benchmark-gpu.json');
const jobDefinition = readJsonFileSync<JobDefinition>('./benchmark.json');

export { pkg, benchmarkGPU, jobDefinition };
