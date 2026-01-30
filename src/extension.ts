import * as vscode from 'vscode';
import { MlxNotebookSerializer } from './serializer';
import { MlxCellStatusBarProvider } from './statusBarProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'mlx-notebook',
      new MlxNotebookSerializer(),
      { transientOutputs: true }
    )
  );

  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      'mlx-notebook',
      new MlxCellStatusBarProvider()
    )
  );
}

export function deactivate() {}
