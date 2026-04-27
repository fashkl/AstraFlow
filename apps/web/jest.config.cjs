/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  moduleNameMapper: {
    '^@livecoding/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@livecoding/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.tsx?$',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
};
