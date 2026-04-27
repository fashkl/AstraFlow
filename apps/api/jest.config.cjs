/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^@livecoding/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@livecoding/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
};
