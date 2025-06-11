module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
};
