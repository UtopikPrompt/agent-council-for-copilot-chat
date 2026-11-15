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
    .office-floor { position: relative; display: grid; gap: 16px; overflow: hidden; padding: 14px; border: 1px solid var(--line); border-radius: 6px; background-color: color-mix(in srgb, var(--vscode-editor-background) 88%, #9a795d); background-image: linear-gradient(45deg, color-mix(in srgb, #f1d8b2 10%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, #f1d8b2 10%, transparent) 75%); background-size: 28px 28px; }
    .office-sign { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--line) 75%, transparent); background: color-mix(in srgb, var(--vscode-editor-background) 82%, #6c5548); }
    .office-sign strong { font-size: 11px; }
    .office-sign span { color: var(--muted); font-size: 10px; }
    .office-zone { position: relative; min-width: 0; padding: 10px; border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); border-radius: 4px; background: color-mix(in srgb, var(--vscode-editor-background) 48%, transparent); }
    .office-zone__heading { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin: 0 0 8px; color: var(--muted); font-size: 10px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
    .office-zone__heading span:last-child { font-weight: 400; letter-spacing: 0; text-transform: none; }
    .agent-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(94px, 1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
    .chairperson-row { grid-template-columns: minmax(110px, 150px); justify-content: center; }
    .meeting-room { display: grid; gap: 8px; padding: 10px; border: 1px solid color-mix(in srgb, var(--teal) 45%, var(--line)); border-radius: 48px / 18px; background: color-mix(in srgb, var(--vscode-editor-background) 60%, var(--teal)); }
    .meeting-room .office-zone__heading { padding: 0 8px; }
    .conference-table { display: grid; min-height: 58px; place-content: center; border: 3px solid #6f5443; border-radius: 50%; color: #f3dfc5; background: linear-gradient(180deg, #a9825e, #79583f); box-shadow: inset 0 0 0 3px color-mix(in srgb, #e0b98e 24%, transparent), 0 4px 0 #594435; text-align: center; }
    .conference-table strong { font-size: 11px; }
    .conference-table span { color: #f3dfc5; font-size: 9px; }
    .specialist-zone { background: color-mix(in srgb, var(--vscode-editor-background) 58%, #748467); }
    .specialist-row { grid-template-columns: repeat(auto-fill, minmax(102px, 1fr)); }
    .agent { position: relative; display: grid; grid-template-rows: 58px auto auto; gap: 3px; min-width: 0; min-height: 102px; padding: 6px 5px; border: 1px solid color-mix(in srgb, var(--line) 62%, transparent); border-radius: 3px; background: color-mix(in srgb, var(--vscode-editor-background) 78%, transparent); box-shadow: 0 2px 0 color-mix(in srgb, #493d32 65%, transparent); }
    .agent[data-current="true"] { border-color: var(--lime); box-shadow: 0 0 0 2px color-mix(in srgb, var(--lime) 36%, transparent), 0 2px 0 #493d32; }
    .agent[data-away="true"] .pixel-sprite { visibility: hidden; }
    .agent-scene { position: relative; display: grid; place-items: center; }
    .agent-scene::before { position: absolute; bottom: 4px; width: 48px; height: 4px; background: var(--desk-top, #8b6951); box-shadow: 0 4px 0 var(--desk-front, #59453a), -7px 8px 0 -1px var(--desk-front, #59453a), 7px 8px 0 -1px var(--desk-front, #59453a); content: ""; }
    .agent-screen { position: absolute; bottom: 13px; width: 18px; height: 11px; border: 2px solid #29363e; background: #8db4a1; box-shadow: inset 0 0 0 2px #516e65; }
    .agent-screen::after { position: absolute; top: 3px; left: 3px; width: 8px; height: 2px; background: #d3e6ba; content: ""; }
    .pixel-sprite { position: absolute; top: 2px; width: 32px; height: 36px; overflow: visible; shape-rendering: crispEdges; }
    .courier { position: absolute; z-index: 3; width: 32px; height: 38px; pointer-events: none; filter: drop-shadow(0 2px 1px #302820); }
    .courier .pixel-sprite { top: 0; }
    .pixel-sprite--coordinator { --sprite-hair: #363342; --sprite-shirt: #c9e36b; }
    .pixel-sprite--advisor { --sprite-hair: #714d45; --sprite-shirt: #59c7b5; }
    .pixel-sprite--specialist { --sprite-hair: #34495c; --sprite-shirt: #ff9770; }
    .pixel-skin { fill: #f0c99b; }
    .pixel-hair { fill: var(--sprite-hair); }
    .pixel-shirt { fill: var(--sprite-shirt); }
    .pixel-pants { fill: #40505a; }
    .pixel-detail { fill: #28343b; }
    .agent-index { position: absolute; top: 3px; right: 4px; color: var(--muted); font-size: 8px; font-variant-numeric: tabular-nums; }
    .agent-name { overflow: hidden; color: var(--ink); font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .agent-meta { display: flex; justify-content: space-between; gap: 4px; align-items: center; min-width: 0; }
    .agent-role { overflow: hidden; color: var(--muted); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
    .agent-status { display: inline-flex; flex: 0 0 auto; gap: 4px; align-items: center; color: var(--muted); font-size: 8px; white-space: nowrap; }
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
    .handoff-note { min-height: 1.4em; margin: 8px 2px 0; color: var(--muted); font-size: 11px; text-align: center; }
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
      <strong>Council-reported activity</strong>
      <p>Characters move only on reported handoffs. This board does not observe Copilot tool or file activity.</p>
    </section>
    <section class="controls" aria-label="Roster filters">
      <input id="search" class="search" type="search" placeholder="Find an agent" aria-label="Find an agent">
      <div class="filters" role="tablist" aria-label="Filter by role"></div>
    </section>
    <section aria-labelledby="roster-title">
      <div class="section-heading">
        <h2 id="roster-title">The Council Office</h2>
        <span id="result-count" aria-live="polite"></span>
      </div>
      <div id="office" class="office-floor" aria-label="Council office floor">
        <div class="office-sign"><strong>UTOPIK / COUNCIL HQ</strong><span>One team, one table</span></div>
        <section class="office-zone" aria-label="Coordinator's chair">
          <h3 class="office-zone__heading"><span>Chairperson</span><span>Head of council</span></h3>
          <ul id="coordinator" class="agent-row chairperson-row"></ul>
        </section>
        <section class="meeting-room" aria-label="Advisors around the conference table">
          <h3 class="office-zone__heading"><span>Advisor meeting room</span><span>Planning together</span></h3>
          <ul id="advisors-north" class="agent-row"></ul>
          <div class="conference-table"><strong>COUNCIL TABLE</strong><span>Shared plans · shared context</span></div>
          <ul id="advisors-south" class="agent-row"></ul>
        </section>
        <section class="office-zone specialist-zone" aria-label="Specialist workstations">
          <h3 class="office-zone__heading"><span>Specialist workstations</span><span>Ready for a handoff</span></h3>
          <ul id="specialists" class="agent-row specialist-row"></ul>
        </section>
        <p id="handoff-note" class="handoff-note" aria-live="polite">Maestro is at the council table.</p>
      </div>
      <p id="empty" class="empty" hidden>No matching agents.</p>
    </section>
    <p class="footnote">Reports stay in memory for this extension host. Prompts, results, and source files are not recorded.</p>
  </main>
  <script nonce="${nonce}">
    const agents = ${serializedAgents};
    const roles = ["All", "Coordinator", "Advisor", "Specialist"];
    const counts = Object.fromEntries(roles.map((role) => [role, role === "All" ? agents.length : agents.filter((agent) => agent.role === role).length]));
    const filters = document.querySelector(".filters");
    const office = document.getElementById("office");
    const coordinatorRoster = document.getElementById("coordinator");
    const advisorsNorth = document.getElementById("advisors-north");
    const advisorsSouth = document.getElementById("advisors-south");
    const specialistsRoster = document.getElementById("specialists");
    const search = document.getElementById("search");
    const resultCount = document.getElementById("result-count");
    const empty = document.getElementById("empty");
    const handoffNote = document.getElementById("handoff-note");
    let activeRole = "All";
    let activities = [];
    const couriers = new Map();

    function activityFor(agent) {
      const matching = activities.filter((activity) => activity.agent === agent.id);
      return matching.find((activity) => activity.status === "dispatching") || matching[0];
    }

    function createSprite(role) {
      const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      sprite.setAttribute("viewBox", "0 0 7 8");
      sprite.setAttribute("class", "pixel-sprite pixel-sprite--" + role.toLowerCase());
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
      return sprite;
    }

    function createAgentCard(agent) {
        const row = document.createElement("li");
        row.className = "agent";
        row.dataset.role = agent.role;
        row.dataset.agentId = agent.id;
        const activity = activityFor(agent);
        row.dataset.status = activity?.status ?? "idle";
        const scene = document.createElement("div");
        scene.className = "agent-scene";
        scene.setAttribute("aria-hidden", "true");
        const screen = document.createElement("span");
        screen.className = "agent-screen";
        scene.append(screen, createSprite(agent.role));
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
    }

    function cardFor(container, agentId) {
      return Array.from(container.children).find((card) => card.dataset.agentId === agentId);
    }

    function cardForAgent(agentId) {
      return cardFor(coordinatorRoster, agentId)
        || cardFor(advisorsNorth, agentId)
        || cardFor(advisorsSouth, agentId)
        || cardFor(specialistsRoster, agentId);
    }

    function scenePosition(scene) {
      const officeRect = office.getBoundingClientRect();
      const sceneRect = scene.getBoundingClientRect();
      return {
        left: sceneRect.left - officeRect.left + sceneRect.width / 2 - 16,
        top: sceneRect.top - officeRect.top + sceneRect.height / 2 - 19,
      };
    }

    function courierPosition(courier) {
      const officeRect = office.getBoundingClientRect();
      const courierRect = courier.getBoundingClientRect();
      return {
        left: courierRect.left - officeRect.left,
        top: courierRect.top - officeRect.top,
      };
    }

    function moveCourier(callerId, destination, returning = false) {
      const caller = cardForAgent(callerId);
      if (!caller) return;
      let trip = couriers.get(callerId);
      const start = trip
        ? courierPosition(trip.element)
        : scenePosition(caller.children[0]);
      if (!trip) {
        const element = document.createElement("div");
        element.className = "courier";
        element.dataset.role = caller.dataset.role;
        element.setAttribute("aria-hidden", "true");
        element.append(createSprite(caller.dataset.role));
        element.style.left = start.left + "px";
        element.style.top = start.top + "px";
        office.append(element);
        trip = { element, targetAgentId: null, animation: null, returning: false };
        couriers.set(callerId, trip);
      }
      if (trip.animation) trip.animation.cancel();

      const end = scenePosition(destination);
      const middle = {
        left: (start.left + end.left) / 2,
        top: (start.top + end.top) / 2 - 22,
      };
      const finish = () => {
        trip.element.style.left = end.left + "px";
        trip.element.style.top = end.top + "px";
        trip.animation = null;
        if (returning) {
          trip.element.remove();
          couriers.delete(callerId);
        }
      };

      const reducedMotion = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion || typeof trip.element.animate !== "function") {
        finish();
        return;
      }

      trip.animation = trip.element.animate([
        { left: start.left + "px", top: start.top + "px" },
        { left: middle.left + "px", top: middle.top + "px" },
        { left: end.left + "px", top: end.top + "px" },
      ], { duration: 1100, easing: "ease-in-out", fill: "forwards" });
      trip.animation.onfinish = finish;
    }

    function updateHandoffs(activeActivities, currentActivity) {
      const currentAgent = currentActivity && agents.find((agent) => agent.id === currentActivity.agent);
      for (const card of [
        ...coordinatorRoster.children,
        ...advisorsNorth.children,
        ...advisorsSouth.children,
        ...specialistsRoster.children,
      ]) {
        card.dataset.current = String(card.dataset.agentId === currentAgent?.id);
      }

      const routes = new Map();
      for (const activity of activeActivities) {
        if (!routes.has(activity.delegatedBy)) {
          routes.set(activity.delegatedBy, activity.agent);
        }
      }

      for (const [callerId, trip] of couriers) {
        if (routes.has(callerId)) continue;
        const caller = cardForAgent(callerId);
        if (!caller) {
          trip.element.remove();
          if (trip.animation) trip.animation.cancel();
          couriers.delete(callerId);
          continue;
        }
        caller.dataset.away = "false";
        if (!trip.returning) {
          trip.returning = true;
          moveCourier(callerId, caller.children[0], true);
        }
      }

      for (const [callerId, targetId] of routes) {
        const caller = cardForAgent(callerId);
        const target = cardForAgent(targetId);
        if (!caller || !target) continue;

        caller.dataset.away = "true";
        let trip = couriers.get(callerId);
        if (!trip) {
          moveCourier(callerId, target.children[0]);
          trip = couriers.get(callerId);
        } else if (trip.targetAgentId !== targetId || trip.returning) {
          trip.returning = false;
          moveCourier(callerId, target.children[0]);
        }
        if (trip) trip.targetAgentId = targetId;
      }

      const latest = activeActivities[0];
      const latestAgent = latest && agents.find((agent) => agent.id === latest.agent);
      const delegator = latest && (latest.delegatedBy === "Orchestrator"
        ? "Maestro"
        : agents.find((agent) => agent.id === latest.delegatedBy)?.name);
      handoffNote.textContent = latestAgent && delegator
        ? delegator + " is handing off to " + latestAgent.name + "."
        : currentAgent
          ? "Last handoff: " + currentAgent.name + "."
          : "Maestro is at the council table.";
    }

    function render() {
      const query = search.value.trim().toLowerCase();
      const visible = agents.filter((agent) => (activeRole === "All" || agent.role === activeRole) && agent.name.toLowerCase().includes(query));
      const coordinators = visible.filter((agent) => agent.role === "Coordinator");
      const advisors = visible.filter((agent) => agent.role === "Advisor");
      const specialists = visible.filter((agent) => agent.role === "Specialist");
      const advisorSplit = Math.ceil(advisors.length / 2);
      coordinatorRoster.replaceChildren(...coordinators.map(createAgentCard));
      advisorsNorth.replaceChildren(...advisors.slice(0, advisorSplit).map(createAgentCard));
      advisorsSouth.replaceChildren(...advisors.slice(advisorSplit).map(createAgentCard));
      specialistsRoster.replaceChildren(...specialists.map(createAgentCard));
      const activeActivities = activities.filter((activity) => activity.status === "dispatching");
      const currentActivity = activeActivities[0] || activities[0];
      updateHandoffs(activeActivities, currentActivity);
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