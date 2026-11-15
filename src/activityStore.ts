import { randomUUID } from "node:crypto";

export type CouncilActivityStatus = "dispatching" | "returned" | "failed";

export interface CouncilActivity {
  runId: string;
  agent: string;
  status: CouncilActivityStatus;
  startedAt: number;
  updatedAt: number;
}

export interface CouncilActivityReport {
  action: CouncilActivityStatus;
  agent: string;
  runId?: string;
}

type ActivityListener = (activities: readonly CouncilActivity[]) => void;

const MAX_ACTIVITY_RECORDS = 80;

export class CouncilActivityStore {
  private readonly allowedAgents: ReadonlySet<string>;
  private readonly records = new Map<string, CouncilActivity>();
  private readonly listeners = new Set<ActivityListener>();

  constructor(agentNames: readonly string[]) {
    this.allowedAgents = new Set(agentNames.filter((name) => name !== "Orchestrator"));
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
        status: "dispatching",
        startedAt: now,
        updatedAt: now,
      };
    } else {
      const runId = report.runId?.trim();
      if (!runId) {
        throw new Error("A runId is required to report a returned or failed dispatch");
      }

      const previous = this.records.get(runId);
      if (!previous || previous.agent !== report.agent || previous.status !== "dispatching") {
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