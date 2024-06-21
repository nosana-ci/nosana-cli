/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '\\.[jt]s?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!@nosana|chalk)'],
};
