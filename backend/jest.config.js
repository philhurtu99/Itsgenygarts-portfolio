/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/sentry.js',
  ],
  verbose: true,
};
