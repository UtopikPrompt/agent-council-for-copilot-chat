const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { summarizeAgentPaths } = require("../dist/src/roster.js");
const { CouncilActivityStore } = require("../dist/src/activityStore.js");
const { renderCouncilHtml } = require("../dist/src/councilHtml.js");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("manifest contributes all 49 council agents", () => {
  const paths = manifest.contributes.chatAgents.map((agent) => agent.path);
  const councilPaths = paths.filter((agentPath) => agentPath.startsWith("./agents/"));
  assert.equal(councilPaths.length, 49);
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

test("the extension validation skill is scoped to this repository's checks", () => {
  const skill = fs.readFileSync(
    path.join(root, ".github", "skills", "extension-validation", "SKILL.md"),
    "utf8",
  );
  assert.match(skill, /^name:\s*extension-validation\s*$/m);
  assert.match(skill, /npm test/);
  assert.match(skill, /npm run test:host/);
  assert.match(skill, /npm run package/);

  const generalist = fs.readFileSync(path.join(root, "agents", "CodeGeneralist.agent.md"), "utf8");
  assert.match(generalist, /extension-validation/);
});

test("the contributed change-validation skill is registered and follows the skill directory contract", () => {
  const skills = manifest.contributes.chatSkills;
  assert.ok(Array.isArray(skills));
  assert.ok(skills.some((skill) => skill.path === "./skills/change-validation/SKILL.md"));

  for (const { path: skillPath } of skills) {
    const fullPath = path.join(root, skillPath);
    assert.ok(fs.existsSync(fullPath), `Missing contributed skill: ${skillPath}`);
    const content = fs.readFileSync(fullPath, "utf8");
    const header = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(header, `Missing skill frontmatter: ${skillPath}`);
    const name = header[1].match(/^name:\s*(.+)\s*$/m);
    assert.ok(name, `Missing skill name: ${skillPath}`);
    assert.equal(name[1], path.basename(path.dirname(fullPath)));
    assert.match(header[1], /^description:\s*.+$/m, `Missing skill description: ${skillPath}`);
  }

  const generalist = fs.readFileSync(path.join(root, "agents", "CodeGeneralist.agent.md"), "utf8");
  assert.match(generalist, /change-validation/);
});

test("roster role counts match the source catalog", () => {
  const agents = summarizeAgentPaths(
    manifest.contributes.chatAgents
      .map((agent) => agent.path)
      .filter((agentPath) => agentPath.startsWith("./agents/")),
  );
  assert.equal(agents.filter((agent) => agent.role === "Coordinator").length, 1);
  assert.equal(agents.filter((agent) => agent.role === "Advisor").length, 7);
  assert.equal(agents.filter((agent) => agent.role === "Specialist").length, 41);
});

test("Maestro is the display name for the Orchestrator role", () => {
  const [agent] = summarizeAgentPaths(["./agents/Orchestrator.agent.md"]);
  assert.deepEqual(agent, { id: "Orchestrator", name: "Maestro", role: "Coordinator" });

  const content = fs.readFileSync(path.join(root, "agents", "Orchestrator.agent.md"), "utf8");
  assert.match(content, /^name:\s*"Maestro"\s*$/m);
});

test("the council webview is local and renders no inferred activity", () => {
  const html = renderCouncilHtml(
    [{ id: "Example", name: "Example", role: "Specialist" }],
    "vscode-webview://test",
    "test-nonce",
  );
  assert.match(html, /Council-reported activity/);
  assert.match(html, /does not observe Copilot tool or file activity/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:\/\//i);
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(script, "Webview script is missing");
  assert.doesNotThrow(() => new vm.Script(script[1]));
});

test("the council office keeps every room visible and animates the active handoff", () => {
  const html = renderCouncilHtml(
    [
      { id: "Orchestrator", name: "Maestro", role: "Coordinator" },
      { id: "CodeDomainAdvisor", name: "Code Domain Advisor", role: "Advisor" },
      { id: "Alpha", name: "Alpha", role: "Specialist" },
    ],
    "vscode-webview://test",
    "test-nonce",
  );
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(script, "Webview script is missing");
  const animations = [];

  function createElement() {
    const element = {
      children: [],
      attributes: {},
      dataset: {},
      listeners: {},
      style: {},
      append(...children) {
        for (const child of children) {
          child.parentNode = this;
          this.children.push(child);
        }
      },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
      },
      replaceChildren(...children) {
        for (const child of children) child.parentNode = this;
        this.children = children;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 32, height: 38 };
      },
      animate(keyframes, options) {
        const animation = {
          keyframes,
          options,
          onfinish: null,
          cancel() {
            this.onfinish = null;
          },
        };
        animations.push(animation);
        return animation;
      },
      remove() {
        if (this.parentNode) {
          this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
        }
      },
      addEventListener(type, listener) {
        this.listeners[type] = listener;
      },
      get textContent() {
        return this.children.map((child) => child.textContent).join("");
      },
      set textContent(value) {
        this.children = [{ textContent: String(value) }];
      },
    };
    return element;
  }

  const filters = createElement();
  const search = createElement();
  search.value = "";
  const coordinator = createElement();
  const advisorsNorth = createElement();
  const advisorsSouth = createElement();
  const specialists = createElement();
  const office = createElement();
  const elements = {
    search,
    office,
    coordinator,
    "advisors-north": advisorsNorth,
    "advisors-south": advisorsSouth,
    specialists,
    "result-count": createElement(),
    empty: createElement(),
    "handoff-note": createElement(),
  };
  const document = {
    querySelector: () => filters,
    getElementById: (id) => elements[id],
    createElement,
    createElementNS: createElement,
    createTextNode: (text) => ({ textContent: text }),
  };
  let messageListener;

  vm.runInNewContext(script[1], {
    document,
    window: { addEventListener: (_type, listener) => { messageListener = listener; } },
    acquireVsCodeApi: () => ({ postMessage() {} }),
  });

  messageListener({
    data: {
      type: "council-activity-snapshot",
      activities: [{
        agent: "CodeDomainAdvisor",
        delegatedBy: "Orchestrator",
        status: "dispatching",
      }],
    },
  });
  assert.equal(coordinator.children.length, 1);
  assert.equal(advisorsNorth.children.length, 1);
  assert.equal(specialists.children.length, 1);
  assert.equal(advisorsNorth.children[0].dataset.agentId, "CodeDomainAdvisor");
  assert.equal(advisorsNorth.children[0].dataset.current, "true");
  assert.equal(coordinator.children[0].dataset.away, "true");
  assert.equal(animations.length, 1);
  assert.equal(animations[0].options.duration, 1100);
  animations[0].onfinish();

  messageListener({
    data: {
      type: "council-activity-snapshot",
      activities: [
        {
          agent: "Alpha",
          delegatedBy: "CodeDomainAdvisor",
          status: "dispatching",
        },
        {
          agent: "CodeDomainAdvisor",
          delegatedBy: "Orchestrator",
          status: "dispatching",
        },
      ],
    },
  });
  assert.equal(coordinator.children[0].dataset.away, "true");
  assert.equal(advisorsNorth.children[0].dataset.away, "true");
  assert.equal(specialists.children[0].dataset.current, "true");
  assert.equal(animations.length, 2);
  animations[1].onfinish();

  messageListener({
    data: {
      type: "council-activity-snapshot",
      activities: [
        {
          agent: "CodeDomainAdvisor",
          delegatedBy: "Orchestrator",
          status: "dispatching",
        },
        {
          agent: "Alpha",
          delegatedBy: "CodeDomainAdvisor",
          status: "returned",
        },
      ],
    },
  });
  assert.equal(advisorsNorth.children[0].dataset.away, "false");
  assert.equal(animations.length, 3);
  animations[2].onfinish();

  messageListener({
    data: {
      type: "council-activity-snapshot",
      activities: [
        {
          agent: "CodeDomainAdvisor",
          delegatedBy: "Orchestrator",
          status: "returned",
        },
        {
          agent: "Alpha",
          delegatedBy: "CodeDomainAdvisor",
          status: "returned",
        },
      ],
    },
  });
  assert.equal(coordinator.children[0].dataset.away, "false");
  assert.equal(animations.length, 4);
  animations[3].onfinish();
  assert.equal(office.children.some((child) => child.className === "courier"), false);
});

test("Orchestrator activity reports enforce lifecycle and agent scope", () => {
  const store = new CouncilActivityStore([
    { id: "Orchestrator", name: "Maestro", role: "Coordinator" },
    { id: "CodeDomainAdvisor", name: "Code Domain Advisor", role: "Advisor" },
    { id: "CodeGeneralist", name: "Code Generalist", role: "Specialist" },
  ]);
  const updates = [];
  const unsubscribe = store.subscribe((snapshot) => updates.push(snapshot));

  const dispatch = store.report({
    action: "dispatching",
    agent: "CodeGeneralist",
    delegatedBy: "CodeDomainAdvisor",
  });
  assert.equal(dispatch.status, "dispatching");
  assert.ok(dispatch.runId);
  assert.deepEqual(Object.keys(dispatch).sort(), ["agent", "delegatedBy", "runId", "startedAt", "status", "updatedAt"]);

  const returned = store.report({
    action: "returned",
    agent: "CodeGeneralist",
    delegatedBy: "CodeDomainAdvisor",
  });
  assert.equal(returned.status, "returned");
  assert.equal(updates.length, 2);

  const parallelDispatches = [
    store.report({
      action: "dispatching",
      agent: "CodeGeneralist",
      delegatedBy: "CodeDomainAdvisor",
    }),
    store.report({
      action: "dispatching",
      agent: "CodeGeneralist",
      delegatedBy: "CodeDomainAdvisor",
    }),
  ];
  assert.throws(() => store.report({
    action: "returned",
    agent: "CodeGeneralist",
    delegatedBy: "CodeDomainAdvisor",
  }), /runId is required/);
  for (const active of parallelDispatches) {
    assert.equal(store.report({
      action: "returned",
      agent: "CodeGeneralist",
      delegatedBy: "CodeDomainAdvisor",
      runId: active.runId,
    }).status, "returned");
  }

  assert.throws(() => store.report({
    action: "failed",
    agent: "CodeGeneralist",
    delegatedBy: "Orchestrator",
    runId: dispatch.runId,
  }));
  assert.throws(() => store.report({
    action: "dispatching",
    agent: "UnknownAgent",
    delegatedBy: "CodeDomainAdvisor",
  }));
  assert.throws(() => store.report({
    action: "dispatching",
    agent: "Orchestrator",
    delegatedBy: "CodeDomainAdvisor",
  }));
  assert.throws(() => store.report({
    action: "dispatching",
    agent: "CodeGeneralist",
    delegatedBy: "CodeGeneralist",
  }));
  assert.throws(() => store.report({
    action: "dispatching",
    agent: "CodeGeneralist",
    delegatedBy: "Orchestrator",
  }), /only to an Advisor/);

  unsubscribe();
  store.dispose();
});

test("manifest exposes the report tool to Maestro and domain Advisors", () => {
  const toolName = "utopikAgentCouncil_reportActivity";
  const toolReference = "utopikprompt.utopik-agent-council-for-copilot-chat/" + toolName;
  const tool = manifest.contributes.languageModelTools.find(({ name }) => name === toolName);
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, [
    "action",
    "agent",
    "delegatedBy",
  ]);
  assert.match(tool.modelDescription, /Every agent-tool edge needs its own separate/);
  assert.match(tool.modelDescription, /does not cover the Advisor-to-Specialist edge/);

  const orchestrator = fs.readFileSync(path.join(root, "agents", "Orchestrator.agent.md"), "utf8");
  assert.ok(orchestrator.includes(toolReference));
  assert.match(orchestrator, /Advisor Routing/);
  assert.match(orchestrator, /does not create or imply the/);
  const specialistNames = summarizeAgentPaths(manifest.contributes.chatAgents.map((agent) => agent.path))
    .filter((agent) => agent.role === "Specialist")
    .map((agent) => agent.id);
  assert.equal(specialistNames.some((name) => orchestrator.includes(name)), false);

  for (const advisor of [
    "CodeDomainAdvisor",
    "InfraDevOpsAdvisor",
    "DocsGovernanceAdvisor",
    "BusinessKnowledgeAdvisor",
    "UtilityAdvisor",
  ]) {
    const definition = fs.readFileSync(path.join(root, "agents", advisor + ".agent.md"), "utf8");
    assert.ok(definition.includes(toolReference), `${advisor} cannot report its handoffs`);
    assert.ok(definition.includes('delegatedBy: "' + advisor + '"'), `${advisor} does not identify its handoffs`);
    assert.match(definition, /^\s+- agent\s*$/m, `${advisor} cannot invoke specialists`);
    assert.match(definition, /Do not answer the .* task yourself/, `${advisor} may substitute its own answer`);
    assert.match(definition, /actual tool result/, `${advisor} may claim an unverified handoff`);
  }

  const codeAdvisor = fs.readFileSync(path.join(root, "agents", "CodeDomainAdvisor.agent.md"), "utf8");
  assert.match(codeAdvisor, /Each agent-tool edge has its own activity pair/);
  assert.match(codeAdvisor, /exact `runId` captured in step 1/);
});

test("the manifest preserves source picker visibility flags", () => {
  const visible = manifest.contributes.chatAgents
    .filter((agent) => {
      const content = fs.readFileSync(path.join(root, agent.path), "utf8");
      return /^user-invocable:\s*true\s*$/m.test(content);
    })
    .map((agent) => path.basename(agent.path))
    .sort();

  assert.deepEqual(visible, ["Orchestrator.agent.md"]);
});

test("picker-hidden agents remain eligible for model invocation", () => {
  const hiddenAgents = manifest.contributes.chatAgents.filter((agent) => {
    const content = fs.readFileSync(path.join(root, agent.path), "utf8");
    return /^user-invocable:\s*false\s*$/m.test(content);
  });

  assert.equal(hiddenAgents.length, 48);
  for (const agent of hiddenAgents) {
    const content = fs.readFileSync(path.join(root, agent.path), "utf8");
    assert.doesNotMatch(content, /^disable-model-invocation:\s*true\s*$/m, agent.path);
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