/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.{js,jsx}'],
  setupFiles: ['<rootDir>/tests/setupViteEnv.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupDom.cjs'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/tests/__mocks__/styleMock.cjs',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/sentry.js',
  ],
};
