import * as vscode from 'vscode';
import { MlxNotebookSerializer } from './serializer';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'mlx-notebook',
      new MlxNotebookSerializer(),
      { transientOutputs: true }
    )
  );
}

export function deactivate() {}
