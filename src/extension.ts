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

  // Register a no-op controller so VS Code doesn't prompt for a kernel
  const controller = vscode.notebooks.createNotebookController(
    'mlx-readonly',
    'mlx-notebook',
    'MATLAB (read-only)'
  );
  controller.supportedLanguages = ['matlab'];
  controller.supportsExecutionOrder = false;
  controller.executeHandler = () => {};
  context.subscriptions.push(controller);

  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      'mlx-notebook',
      new MlxCellStatusBarProvider()
    )
  );
}

export function deactivate() {}
