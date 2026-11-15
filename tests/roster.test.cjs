const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { summarizeAgentPaths } = require("../dist/src/roster.js");
const { renderCouncilHtml } = require("../dist/src/councilHtml.js");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("manifest contributes all 49 agent definitions", () => {
  const paths = manifest.contributes.chatAgents.map((agent) => agent.path);
  assert.equal(paths.length, 49);
  assert.equal(new Set(paths).size, paths.length);

  for (const agentPath of paths) {
    const fullPath = path.join(root, agentPath);
    assert.ok(fs.existsSync(fullPath), `Missing contributed file: ${agentPath}`);
    const content = fs.readFileSync(fullPath, "utf8");
    const header = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(header, `Missing frontmatter: ${agentPath}`);
    assert.match(header[1], /^name:\s*.+$/m, `Missing name: ${agentPath}`);
    assert.match(header[1], /^description:\s*.+$/m, `Missing description: ${agentPath}`);
    assert.doesNotMatch(header[1], /^(argument-hint|agents):/m, `Copilot-incompatible field: ${agentPath}`);
    assert.match(header[1], /^user-invocable:\s*(true|false)\s*$/m, `Missing picker visibility setting: ${agentPath}`);
    assert.match(header[1], /^tools:/m, `Missing tool constraints: ${agentPath}`);
  }
});

test("roster role counts match the source catalog", () => {
  const agents = summarizeAgentPaths(manifest.contributes.chatAgents.map((agent) => agent.path));
  assert.equal(agents.filter((agent) => agent.role === "Coordinator").length, 1);
  assert.equal(agents.filter((agent) => agent.role === "Advisor").length, 7);
  assert.equal(agents.filter((agent) => agent.role === "Specialist").length, 41);
});

test("the council webview is local and renders no inferred activity", () => {
  const html = renderCouncilHtml(
    [{ id: "Example", name: "Example", role: "Specialist" }],
    "vscode-webview://test",
    "test-nonce",
  );
  assert.match(html, /Live activity is not available/);
  assert.match(html, /Decorative motion only/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket|https?:\/\//);
});

test("the manifest preserves source picker visibility flags", () => {
  const visible = manifest.contributes.chatAgents
    .map((agent) => path.basename(agent.path))
    .filter((filename) => {
      const content = fs.readFileSync(path.join(root, "agents", filename), "utf8");
      return /^user-invocable:\s*true\s*$/m.test(content);
    })
    .sort();

  assert.deepEqual(visible, ["Orchestrator.agent.md"]);
});

test("picker-hidden agents remain eligible for model invocation", () => {
  const hiddenAgents = manifest.contributes.chatAgents.filter((agent) => {
    const filename = path.basename(agent.path);
    const content = fs.readFileSync(path.join(root, "agents", filename), "utf8");
    return /^user-invocable:\s*false\s*$/m.test(content);
  });

  assert.equal(hiddenAgents.length, 48);
  for (const agent of hiddenAgents) {
    const filename = path.basename(agent.path);
    const content = fs.readFileSync(path.join(root, "agents", filename), "utf8");
    assert.doesNotMatch(content, /^disable-model-invocation:\s*true\s*$/m, filename);
  }
});

test("the source model preferences are preserved for Copilot", () => {
  const expectedModels = new Map([
    ["CodeBackendAdvisor.agent.md", '"Claude Haiku 5.5"'],
    ["CodeDomainAdvisor.agent.md", '"Claude Haiku 5.5"'],
    ["CodeFrontendAdvisor.agent.md", '"Claude Haiku 5.5"'],
    ["DocsGovernanceAdvisor.agent.md", '"Claude Haiku 5.5"'],
    ["InfraDevOpsAdvisor.agent.md", '"Claude Haiku 5.5"'],
    ["Orchestrator.agent.md", '["GPT-6 Luna", "Claude Haiku 5.5"]'],
    ["UtilityAdvisor.agent.md", '"Claude Haiku 5.5"'],
  ]);

  for (const [filename, expected] of expectedModels) {
    const content = fs.readFileSync(path.join(root, "agents", filename), "utf8");
    const header = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(header, `Missing frontmatter: ${filename}`);
    const modelLine = header[1].split(/\r?\n/).find((line) => line.startsWith("model:"));
    assert.equal(modelLine?.slice("model:".length).trim(), expected, filename);
  }
});