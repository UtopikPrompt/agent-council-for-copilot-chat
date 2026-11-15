const path = require("node:path");
const { runTests } = require("@vscode/test-electron");

runTests({
  version: "1.146.0",
  extensionDevelopmentPath: path.resolve(__dirname, ".."),
  extensionTestsPath: path.resolve(__dirname, "../dist/tests/extensionHost.test.js"),
  launchArgs: ["--disable-workspace-trust", "--disable-gpu"],
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});