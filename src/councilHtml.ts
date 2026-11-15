import type { AgentSummary } from "./roster";

export function renderCouncilHtml(
  agents: readonly AgentSummary[],
  cspSource: string,
  nonce: string,
): string {
  const serializedAgents = JSON.stringify(agents).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Utopik Agent Council</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      --ink: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --line: var(--vscode-panel-border);
      --field: var(--vscode-input-background);
      --field-ink: var(--vscode-input-foreground);
      --focus: var(--vscode-focusBorder);
      --lime: #c9e36b;
      --coral: #ff9770;
      --teal: #59c7b5;
      --content-width: 720px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px 16px 26px;
      color: var(--ink);
      background: var(--vscode-sideBar-background);
      font: 13px/1.45 var(--vscode-font-family);
    }
    main { max-width: var(--content-width); margin: 0 auto; }
    .masthead { display: grid; grid-template-columns: 1fr 76px; gap: 12px; align-items: center; }
    .eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 10px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 20px; font-weight: 650; line-height: 1.15; }
    .subhead { margin: 6px 0 0; color: var(--muted); }
    .seal { position: relative; display: grid; width: 72px; aspect-ratio: 1; place-items: center; }
    .seal__ring, .seal__orbit { position: absolute; inset: 4px; border: 1px solid color-mix(in srgb, var(--ink) 24%, transparent); border-radius: 50%; }
    .seal__orbit { inset: 12px 0; border-color: color-mix(in srgb, var(--coral) 76%, transparent); transform: rotate(-35deg); animation: orbit 18s linear infinite; }
    .seal__orbit::after { position: absolute; top: 4px; left: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--lime); content: ""; }
    .seal__core { display: grid; place-items: center; width: 42px; aspect-ratio: 1; border: 1px solid var(--teal); border-radius: 50%; font-size: 15px; font-weight: 700; }
    .seal__core span { display: block; font-size: 9px; font-weight: 500; color: var(--muted); }
    @keyframes orbit { to { transform: rotate(325deg); } }
    .notice { margin: 18px 0; padding: 11px 12px; border-left: 2px solid var(--coral); background: color-mix(in srgb, var(--coral) 8%, transparent); }
    .notice strong { display: block; margin-bottom: 3px; font-size: 12px; }
    .notice p { margin: 0; color: var(--muted); }
    .controls { display: grid; gap: 10px; }
    .search { width: 100%; min-height: 34px; padding: 6px 9px; border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 3px; color: var(--field-ink); background: var(--field); font: inherit; }
    .search:focus-visible, .filter:focus-visible { outline: 1px solid var(--focus); outline-offset: 1px; }
    .filters { display: flex; gap: 4px; overflow-x: auto; }
    .filter { min-height: 29px; padding: 4px 8px; border: 1px solid transparent; border-radius: 3px; color: var(--muted); background: transparent; font: inherit; white-space: nowrap; cursor: pointer; }
    .filter[aria-selected="true"] { border-color: var(--line); color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
    .filter-count { color: var(--muted); font-size: 11px; }
    .section-heading { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin: 18px 0 7px; }
    h2 { margin: 0; font-size: 12px; font-weight: 650; }
    #result-count { color: var(--muted); font-size: 11px; }
    .roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); margin: 0; padding: 8px; list-style: none; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background-color: color-mix(in srgb, var(--vscode-editor-background) 86%, var(--teal)); background-image: linear-gradient(45deg, color-mix(in srgb, var(--ink) 4%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--ink) 4%, transparent) 75%); background-size: 24px 24px; }
    .agent { position: relative; display: grid; grid-template-rows: 64px auto auto; gap: 4px; min-width: 0; min-height: 112px; padding: 8px 6px; border-right: 1px solid color-mix(in srgb, var(--line) 55%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent); }
    .agent-scene { position: relative; display: grid; place-items: center; }
    .agent-scene::before { position: absolute; bottom: 5px; width: 58px; height: 4px; background: var(--desk-top, #8b6951); box-shadow: 0 4px 0 var(--desk-front, #59453a), -8px 8px 0 -1px var(--desk-front, #59453a), 8px 8px 0 -1px var(--desk-front, #59453a); content: ""; }
    .agent-screen { position: absolute; bottom: 15px; width: 20px; height: 13px; border: 2px solid #29363e; background: #8db4a1; box-shadow: inset 0 0 0 2px #516e65; }
    .agent-screen::after { position: absolute; top: 4px; left: 4px; width: 8px; height: 2px; background: #d3e6ba; content: ""; }
    .pixel-sprite { position: absolute; top: 2px; width: 32px; height: 36px; overflow: visible; shape-rendering: crispEdges; }
    .pixel-sprite--coordinator { --sprite-hair: #363342; --sprite-shirt: #c9e36b; }
    .pixel-sprite--advisor { --sprite-hair: #714d45; --sprite-shirt: #59c7b5; }
    .pixel-sprite--specialist { --sprite-hair: #34495c; --sprite-shirt: #ff9770; }
    .pixel-skin { fill: #f0c99b; }
    .pixel-hair { fill: var(--sprite-hair); }
    .pixel-shirt { fill: var(--sprite-shirt); }
    .pixel-pants { fill: #40505a; }
    .pixel-detail { fill: #28343b; }
    .agent-index { position: absolute; top: 3px; right: 4px; color: var(--muted); font-size: 9px; font-variant-numeric: tabular-nums; }
    .agent-name { overflow: hidden; color: var(--ink); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .agent-meta { display: flex; justify-content: space-between; gap: 4px; align-items: center; min-width: 0; }
    .agent-role { overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .agent-status { display: inline-flex; flex: 0 0 auto; gap: 4px; align-items: center; color: var(--muted); font-size: 9px; white-space: nowrap; }
    .agent-status__indicator { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); }
    .agent[data-status="dispatching"] .agent-status { color: var(--lime); }
    .agent[data-status="dispatching"] .agent-status__indicator { background: var(--lime); animation: signal 1.1s ease-in-out infinite; }
    .agent[data-status="dispatching"] .pixel-sprite { animation: typing .42s steps(2, end) infinite; }
    .agent[data-status="returned"] .agent-status__indicator { background: var(--teal); }
    .agent[data-status="failed"] .agent-status { color: var(--coral); }
    .agent[data-status="failed"] .agent-status__indicator { background: var(--coral); }
    .agent[data-role="Coordinator"] .agent-role { color: var(--lime); }
    .agent[data-role="Advisor"] .agent-role { color: var(--teal); }
    @keyframes typing { 50% { transform: translateY(-2px); } }
    .empty { padding: 20px 4px; color: var(--muted); text-align: center; }
    .footnote { margin: 18px 0 0; color: var(--muted); font-size: 11px; }
    @keyframes signal { 50% { opacity: .35; transform: scale(.75); } }
    @media (prefers-reduced-motion: reduce) { .seal__orbit, .agent-status__indicator, .pixel-sprite { animation: none !important; } }
  </style>
</head>
<body>
  <main>
    <header class="masthead">
      <div>
        <p class="eyebrow">Utopik / Copilot Chat</p>
        <h1>Agent Council</h1>
        <p class="subhead">A pixel office for ${agents.length} contributed agents</p>
      </div>
      <div class="seal" aria-hidden="true">
        <span class="seal__ring"></span>
        <span class="seal__orbit"></span>
        <div class="seal__core">${agents.length}<span>agents</span></div>
      </div>
    </header>
    <section class="notice" aria-live="polite">
      <strong>Orchestrator-reported activity</strong>
      <p>Characters move only on reported dispatch events. This board does not observe Copilot tool or file activity.</p>
    </section>
    <section class="controls" aria-label="Roster filters">
      <input id="search" class="search" type="search" placeholder="Find an agent" aria-label="Find an agent">
      <div class="filters" role="tablist" aria-label="Filter by role"></div>
    </section>
    <section aria-labelledby="roster-title">
      <div class="section-heading">
        <h2 id="roster-title">Roster</h2>
        <span id="result-count" aria-live="polite"></span>
      </div>
      <ul id="roster" class="roster" aria-label="Agent office"></ul>
      <p id="empty" class="empty" hidden>No matching agents.</p>
    </section>
    <p class="footnote">Reports stay in memory for this extension host. Prompts, results, and source files are not recorded.</p>
  </main>
  <script nonce="${nonce}">
    const agents = ${serializedAgents};
    const roles = ["All", "Coordinator", "Advisor", "Specialist"];
    const counts = Object.fromEntries(roles.map((role) => [role, role === "All" ? agents.length : agents.filter((agent) => agent.role === role).length]));
    const filters = document.querySelector(".filters");
    const roster = document.getElementById("roster");
    const search = document.getElementById("search");
    const resultCount = document.getElementById("result-count");
    const empty = document.getElementById("empty");
    let activeRole = "All";
    let activities = [];

    function activityFor(agent) {
      const matching = activities.filter((activity) => activity.agent === agent.id);
      return matching.find((activity) => activity.status === "dispatching") || matching[0];
    }

    function render() {
      const query = search.value.trim().toLowerCase();
      const visible = agents.filter((agent) => (activeRole === "All" || agent.role === activeRole) && agent.name.toLowerCase().includes(query));
      roster.replaceChildren(...visible.map((agent) => {
        const row = document.createElement("li");
        row.className = "agent";
        row.dataset.role = agent.role;
        const activity = activityFor(agent);
        row.dataset.status = activity?.status ?? "idle";
        const scene = document.createElement("div");
        scene.className = "agent-scene";
        scene.setAttribute("aria-hidden", "true");
        const screen = document.createElement("span");
        screen.className = "agent-screen";
        const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sprite.setAttribute("viewBox", "0 0 7 8");
        sprite.setAttribute("class", "pixel-sprite pixel-sprite--" + agent.role.toLowerCase());
        sprite.setAttribute("aria-hidden", "true");
        const pixels = ["..111..", ".12221.", ".12221.", "..555..", ".33333.", ".3.3.3.", ".4...4.", ".4...4."];
        const palette = { "1": "pixel-hair", "2": "pixel-skin", "3": "pixel-shirt", "4": "pixel-pants", "5": "pixel-detail" };
        for (const [y, line] of pixels.entries()) {
          for (const [x, color] of Array.from(line).entries()) {
            if (color === ".") continue;
            const pixel = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            pixel.setAttribute("x", String(x));
            pixel.setAttribute("y", String(y));
            pixel.setAttribute("width", "1");
            pixel.setAttribute("height", "1");
            pixel.setAttribute("class", palette[color]);
            sprite.append(pixel);
          }
        }
        scene.append(screen, sprite);
        const index = document.createElement("span");
        index.className = "agent-index";
        index.textContent = String(agents.indexOf(agent) + 1).padStart(2, "0");
        const name = document.createElement("span");
        name.className = "agent-name";
        name.textContent = agent.name;
        const meta = document.createElement("div");
        meta.className = "agent-meta";
        const role = document.createElement("span");
        role.className = "agent-role";
        role.textContent = agent.role;
        const status = document.createElement("span");
        status.className = "agent-status";
        row.dataset.status = activity?.status ?? "idle";
        const indicator = document.createElement("span");
        indicator.className = "agent-status__indicator";
        indicator.setAttribute("aria-hidden", "true");
        const statusText = activity?.status === "dispatching"
          ? "Dispatching"
          : activity?.status === "returned"
            ? "Returned"
            : activity?.status === "failed"
              ? "Failed"
              : "Available";
        status.append(indicator, document.createTextNode(statusText));
        meta.append(role, status);
        row.append(scene, index, name, meta);
        return row;
      }));
      resultCount.textContent = String(visible.length) + " / " + agents.length;
      empty.hidden = visible.length > 0;
    }

    for (const role of roles) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.role = "tab";
      button.setAttribute("aria-selected", String(role === activeRole));
      button.textContent = role + " ";
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(counts[role]);
      button.append(count);
      button.addEventListener("click", () => {
        activeRole = role;
        for (const item of filters.children) item.setAttribute("aria-selected", String(item.textContent.startsWith(role + " ")));
        render();
      });
      filters.append(button);
    }

    const vscode = acquireVsCodeApi();
    window.addEventListener("message", (event) => {
      if (event.data?.type === "council-activity-snapshot" && Array.isArray(event.data.activities)) {
        activities = event.data.activities;
        render();
      }
    });
    search.addEventListener("input", render);
    render();
    vscode.postMessage({ type: "council-ready" });
  </script>
</body>
</html>`;
}