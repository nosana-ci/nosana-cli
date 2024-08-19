import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const customDirname = path.dirname(fileURLToPath(import.meta.url));

function readJsonFileSync(filePath: string) {
  const absolutePath = path.resolve(customDirname, filePath);
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(fileContent);
}

const pkg = readJsonFileSync('../package.json');
const benchmarkGPU = readJsonFileSync('./static/benchmark-gpu.json');
const jobDefinition = readJsonFileSync('./static/benchmark.json');

export { pkg, benchmarkGPU, jobDefinition };
