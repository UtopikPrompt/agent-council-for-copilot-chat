export type AgentRole = "Coordinator" | "Advisor" | "Specialist";

export interface AgentSummary {
  id: string;
  name: string;
  role: AgentRole;
}

export function summarizeAgentPaths(paths: readonly string[]): AgentSummary[] {
  const agents = paths.map((path) => {
    const filename = path.replace(/\\/g, "/").split("/").at(-1) ?? path;
    const name = filename.replace(/\.agent\.md$/i, "");

    if (name === filename) {
      throw new Error(`Not an agent definition path: ${path}`);
    }

    const displayName = name === "Orchestrator" ? "Maestro" : name;
    return { id: name, name: displayName, role: getAgentRole(name) };
  });

  return agents.sort((left, right) => {
    const roleOrder: Record<AgentRole, number> = {
      Coordinator: 0,
      Advisor: 1,
      Specialist: 2,
    };

    return roleOrder[left.role] - roleOrder[right.role] || left.name.localeCompare(right.name);
  });
}

function getAgentRole(name: string): AgentRole {
  if (name === "Orchestrator") {
    return "Coordinator";
  }

  return name.endsWith("Advisor") ? "Advisor" : "Specialist";
}