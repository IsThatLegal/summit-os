/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true, // Explicitly tell ts-jest to use ESM
      },
    ],
    // If you have other JS files that need transformation, you might need a separate Babel transform here
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!node-fetch)', // Explicitly don't ignore node-fetch
  ],
  // This is crucial for ESM in Jest
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

module.exports = config;
