import pkg from '../package.json' with { type: 'json' };
import benchmarkGPU from './static/benchmark-gpu.json' with { type: 'json' };
import jobDefinition from './static/benchmark.json' with { type: 'json' };

export { pkg, benchmarkGPU, jobDefinition };
