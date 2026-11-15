import * as vscode from "vscode";
import { CouncilActivityStore } from "./activityStore";
import { CouncilActivityTool, COUNCIL_ACTIVITY_TOOL_NAME } from "./councilActivityTool";
import { CouncilViewProvider } from "./councilView";
import { summarizeAgentPaths } from "./roster";

export function activate(context: vscode.ExtensionContext): void {
  const contributions = context.extension.packageJSON.contributes?.chatAgents as
    | Array<{ path: string }>
    | undefined;
  const agents = summarizeAgentPaths((contributions ?? []).map((agent) => agent.path));
  const activityStore = new CouncilActivityStore(agents.map((agent) => agent.id));

  context.subscriptions.push(
    activityStore,
    vscode.lm.registerTool(
      COUNCIL_ACTIVITY_TOOL_NAME,
      new CouncilActivityTool(activityStore),
    ),
    vscode.window.registerWebviewViewProvider(
      "utopikAgentCouncil.roster",
      new CouncilViewProvider(agents, activityStore),
    ),
  );
}

export function deactivate(): void {}