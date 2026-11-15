import * as vscode from "vscode";
import { CouncilActivityStore, type CouncilActivityReport } from "./activityStore";

export const COUNCIL_ACTIVITY_TOOL_NAME = "utopikAgentCouncil_reportActivity";

export class CouncilActivityTool implements vscode.LanguageModelTool<CouncilActivityReport> {
  constructor(private readonly activityStore: CouncilActivityStore) {}

  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<CouncilActivityReport>) {
    const { action, agent } = options.input;
    return {
      invocationMessage: `Council report: ${agent} ${action}`,
    };
  }

  invoke(options: vscode.LanguageModelToolInvocationOptions<CouncilActivityReport>) {
    const activity = this.activityStore.report(options.input);
    const result = {
      recorded: true,
      runId: activity.runId,
      agent: activity.agent,
      delegatedBy: activity.delegatedBy,
      status: activity.status,
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(result)),
    ]);
  }
}