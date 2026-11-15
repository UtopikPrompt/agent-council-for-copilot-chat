import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { renderCouncilHtml } from "./councilHtml";
import type { AgentSummary } from "./roster";

export class CouncilViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly agents: readonly AgentSummary[]) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = renderCouncilHtml(
      this.agents,
      view.webview.cspSource,
      createNonce(),
    );
  }
}

function createNonce(): string {
  return randomBytes(16).toString("base64");
}