module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: [
    "<rootDir>/src",
    "<rootDir>/tests",
    "<rootDir>/genesis",
  ],

  testMatch: [
    "**/__tests__/**/*.ts?(x)",
    "**/?(*.)+(spec|test).ts?(x)",
  ],

  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node",
  ],

  collectCoverageFrom: [
    "src/**/*.ts",
    "genesis/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!genesis/**/index.ts",
  ],

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
