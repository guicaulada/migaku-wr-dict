require("module-alias/register");

module.exports = {
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  coveragePathIgnorePatterns: ["<rootDir>/node_modules/(?!@foo)"],
  transformIgnorePatterns: ["<rootDir>/node_modules/(?!@foo)"],
  modulePathIgnorePatterns: ["^.+\\.mock.ts?$"],
  collectCoverageFrom: ["src/**/*.ts"],
  coverageReporters: ["text-lcov", "lcov", "text"],
  reporters: ["default", "jest-junit"],
};
