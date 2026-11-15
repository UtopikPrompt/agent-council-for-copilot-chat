import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { COUNCIL_ACTIVITY_TOOL_NAME } from "../src/councilActivityTool";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "utopikprompt.utopik-agent-council-for-copilot-chat",
  );

  assert.ok(extension, "Extension Development Host did not load the extension");
  await extension.activate();
  assert.equal(extension.isActive, true);
  assert.equal(extension.packageJSON.displayName, "Utopik Agent Council for Copilot Chat");
  assert.equal(extension.packageJSON.contributes.chatAgents.length, 49);
  assert.ok(extension.packageJSON.contributes.languageModelTools.some(
    (tool: { name: string }) => tool.name === COUNCIL_ACTIVITY_TOOL_NAME,
  ));
  assert.ok(vscode.lm.tools.some((tool) => tool.name === COUNCIL_ACTIVITY_TOOL_NAME));
  assert.ok(extension.packageJSON.contributes.views.utopikAgentCouncil);
  await vscode.commands.executeCommand("workbench.view.extension.utopikAgentCouncil");

  const dispatchResult = await vscode.lm.invokeTool(COUNCIL_ACTIVITY_TOOL_NAME, {
    input: { action: "dispatching", agent: "CodeDomainAdvisor", delegatedBy: "Orchestrator" },
    toolInvocationToken: undefined,
  });
  const dispatchText = dispatchResult.content.find(
    (part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart,
  );
  assert.ok(dispatchText, "Dispatch report did not return a result");
  const dispatch = JSON.parse(dispatchText.value) as { runId: string; status: string; delegatedBy: string };
  assert.equal(dispatch.status, "dispatching");
  assert.equal(dispatch.delegatedBy, "Orchestrator");
  assert.ok(dispatch.runId);

  const returnResult = await vscode.lm.invokeTool(COUNCIL_ACTIVITY_TOOL_NAME, {
    input: {
      action: "returned",
      agent: "CodeDomainAdvisor",
      delegatedBy: "Orchestrator",
      runId: dispatch.runId,
    },
    toolInvocationToken: undefined,
  });
  const returnText = returnResult.content.find(
    (part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart,
  );
  assert.ok(returnText, "Return report did not return a result");
  assert.equal((JSON.parse(returnText.value) as { status: string }).status, "returned");
}