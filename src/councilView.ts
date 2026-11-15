import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import type { CouncilActivityStore } from "./activityStore";
import { renderCouncilHtml } from "./councilHtml";
import type { AgentSummary } from "./roster";

export class CouncilViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly agents: readonly AgentSummary[],
    private readonly activityStore: CouncilActivityStore,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    let webviewReady = false;
    const sendSnapshot = () => {
      void view.webview.postMessage({
        type: "council-activity-snapshot",
        activities: this.activityStore.snapshot(),
      });
    };
    const messageListener = view.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message === "object" && message !== null && "type" in message && message.type === "council-ready") {
        webviewReady = true;
        sendSnapshot();
      }
    });
    const unsubscribe = this.activityStore.subscribe(() => {
      if (webviewReady) {
        sendSnapshot();
      }
    });

    view.onDidDispose(() => {
      messageListener.dispose();
      unsubscribe();
    });
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