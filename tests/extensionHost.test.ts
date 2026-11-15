import * as assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "utopikprompt.utopik-agent-council-for-copilot-chat",
  );

  assert.ok(extension, "Extension Development Host did not load the extension");
  await extension.activate();
  assert.equal(extension.isActive, true);
  assert.equal(extension.packageJSON.displayName, "Utopik Agent Council for Copilot Chat");
  assert.equal(extension.packageJSON.contributes.chatAgents.length, 49);
  assert.ok(extension.packageJSON.contributes.views.utopikAgentCouncil);
  await vscode.commands.executeCommand("workbench.view.extension.utopikAgentCouncil");
}