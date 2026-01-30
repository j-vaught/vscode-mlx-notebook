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

  // Read-only controller prevents VS Code from prompting for a kernel
  // or falling back to the MathWorks MATLAB extension's kernel
  const controller = vscode.notebooks.createNotebookController(
    'mlx-readonly',
    'mlx-notebook',
    'Read-only (cached output)'
  );
  controller.supportedLanguages = ['matlab'];
  controller.supportsExecutionOrder = false;
  controller.executeHandler = (_cells, _notebook, ctrl) => {
    // No-op: this is a read-only viewer
    for (const cell of _cells) {
      const exec = ctrl.createNotebookCellExecution(cell);
      exec.start();
      exec.end(true);
    }
  };
  context.subscriptions.push(controller);

  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      'mlx-notebook',
      new MlxCellStatusBarProvider()
    )
  );
}

export function deactivate() {}
