import * as vscode from "vscode";
import { CouncilViewProvider } from "./councilView";
import { summarizeAgentPaths } from "./roster";

export function activate(context: vscode.ExtensionContext): void {
  const contributions = context.extension.packageJSON.contributes?.chatAgents as
    | Array<{ path: string }>
    | undefined;
  const agents = summarizeAgentPaths((contributions ?? []).map((agent) => agent.path));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "utopikAgentCouncil.roster",
      new CouncilViewProvider(agents),
    ),
  );
}

export function deactivate(): void {}