import { randomUUID } from "node:crypto";
import type { AgentSummary } from "./roster";

export type CouncilActivityStatus = "dispatching" | "returned" | "failed";

export interface CouncilActivity {
  runId: string;
  agent: string;
  delegatedBy: string;
  status: CouncilActivityStatus;
  startedAt: number;
  updatedAt: number;
}

export interface CouncilActivityReport {
  action: CouncilActivityStatus;
  agent: string;
  delegatedBy: string;
  runId?: string;
}

type ActivityListener = (activities: readonly CouncilActivity[]) => void;

const MAX_ACTIVITY_RECORDS = 80;

export class CouncilActivityStore {
  private readonly agentsById: ReadonlyMap<string, AgentSummary>;
  private readonly allowedAgents: ReadonlySet<string>;
  private readonly allowedDelegators: ReadonlySet<string>;
  private readonly records = new Map<string, CouncilActivity>();
  private readonly listeners = new Set<ActivityListener>();

  constructor(agents: readonly AgentSummary[]) {
    this.agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    this.allowedAgents = new Set(agents.filter((agent) => agent.role !== "Coordinator").map((agent) => agent.id));
    this.allowedDelegators = new Set([
      ...agents.filter((agent) => agent.role !== "Specialist").map((agent) => agent.id),
    ]);
  }

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): CouncilActivity[] {
    return [...this.records.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((activity) => ({ ...activity }));
  }

  report(report: CouncilActivityReport): CouncilActivity {
    if (!this.allowedAgents.has(report.agent)) {
      throw new Error(`Unknown council agent: ${report.agent}`);
    }
    if (!this.allowedDelegators.has(report.delegatedBy)) {
      throw new Error(`Unknown council delegator: ${report.delegatedBy}`);
    }
    const target = this.agentsById.get(report.agent);
    const delegator = this.agentsById.get(report.delegatedBy);
    if (delegator?.role === "Coordinator" && target?.role !== "Advisor") {
      throw new Error("A Coordinator may delegate only to an Advisor");
    }

    const now = Date.now();
    let activity: CouncilActivity;

    if (report.action === "dispatching") {
      const runId = report.runId?.trim() || randomUUID();
      if (this.records.has(runId)) {
        throw new Error(`Council activity run already exists: ${runId}`);
      }

      activity = {
        runId,
        agent: report.agent,
        delegatedBy: report.delegatedBy,
        status: "dispatching",
        startedAt: now,
        updatedAt: now,
      };
    } else {
      const runId = report.runId?.trim();
      const matches = runId
        ? [this.records.get(runId)].filter((activity): activity is CouncilActivity => activity !== undefined)
        : [...this.records.values()].filter((activity) =>
          activity.agent === report.agent
          && activity.delegatedBy === report.delegatedBy
          && activity.status === "dispatching");
      if (matches.length > 1) {
        throw new Error(`Multiple dispatches are active for ${report.agent}; a runId is required`);
      }

      const previous = matches[0];
      if (!previous
        || previous.agent !== report.agent
        || previous.delegatedBy !== report.delegatedBy
        || previous.status !== "dispatching") {
        throw new Error(`No matching dispatch is active for ${report.agent}`);
      }

      activity = { ...previous, status: report.action, updatedAt: now };
    }

    this.records.set(activity.runId, activity);
    this.pruneHistory();
    this.publish();
    return { ...activity };
  }

  dispose(): void {
    this.records.clear();
    this.listeners.clear();
  }

  private pruneHistory(): void {
    while (this.records.size > MAX_ACTIVITY_RECORDS) {
      const oldestFinished = [...this.records.values()]
        .filter((activity) => activity.status !== "dispatching")
        .sort((left, right) => left.updatedAt - right.updatedAt)[0];

      if (!oldestFinished) {
        return;
      }

      this.records.delete(oldestFinished.runId);
    }
  }

  private publish(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}