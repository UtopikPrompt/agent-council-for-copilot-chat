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
    .roster { margin: 0; padding: 0; list-style: none; }
    .agent { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 8px; align-items: center; min-height: 38px; border-top: 1px solid var(--line); }
    .agent-index { color: var(--muted); font-variant-numeric: tabular-nums; }
    .agent-name { overflow-wrap: anywhere; font-weight: 550; }
    .agent-role { padding: 2px 6px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); font-size: 10px; white-space: nowrap; }
    .agent[data-role="Coordinator"] .agent-role { border-color: color-mix(in srgb, var(--lime) 55%, var(--line)); color: var(--ink); }
    .agent[data-role="Advisor"] .agent-role { border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); }
    .empty { padding: 20px 4px; color: var(--muted); text-align: center; }
    .footnote { margin: 18px 0 0; color: var(--muted); font-size: 11px; }
    @media (prefers-reduced-motion: reduce) { .seal__orbit { animation: none; } }
  </style>
</head>
<body>
  <main>
    <header class="masthead">
      <div>
        <p class="eyebrow">Utopik / Copilot Chat</p>
        <h1>Agent Council</h1>
        <p class="subhead">A roster of ${agents.length} contributed definitions</p>
      </div>
      <div class="seal" aria-hidden="true">
        <span class="seal__ring"></span>
        <span class="seal__orbit"></span>
        <div class="seal__core">${agents.length}<span>agents</span></div>
      </div>
    </header>
    <section class="notice" aria-live="polite">
      <strong>Live activity is not available</strong>
      <p>VS Code does not expose Copilot session or subagent activity events to extensions. This catalog shows definitions only.</p>
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
      <ul id="roster" class="roster"></ul>
      <p id="empty" class="empty" hidden>No matching agents.</p>
    </section>
    <p class="footnote">Decorative motion only. No chat history, prompts, source files, or activity are read or stored.</p>
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

    function render() {
      const query = search.value.trim().toLowerCase();
      const visible = agents.filter((agent) => (activeRole === "All" || agent.role === activeRole) && agent.name.toLowerCase().includes(query));
      roster.replaceChildren(...visible.map((agent) => {
        const row = document.createElement("li");
        row.className = "agent";
        row.dataset.role = agent.role;
        const index = document.createElement("span");
        index.className = "agent-index";
        index.textContent = String(agents.indexOf(agent) + 1).padStart(2, "0");
        const name = document.createElement("span");
        name.className = "agent-name";
        name.textContent = agent.name;
        const role = document.createElement("span");
        role.className = "agent-role";
        role.textContent = agent.role;
        row.append(index, name, role);
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

    search.addEventListener("input", render);
    render();
  </script>
</body>
</html>`;
}