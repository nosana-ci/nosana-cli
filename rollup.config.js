import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';



// import replace from '@rollup/plugin-replace';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'Nosana'
    },
  ],
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs({
      include: /node_modules/,
      requireReturnsDefault: 'auto', // <---- this solves default issue
    }),
    nodePolyfills({
      include: null
    }),
    typescript()
  ]
}