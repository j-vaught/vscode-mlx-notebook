import * as vscode from 'vscode';

export class MlxCellStatusBarProvider implements vscode.NotebookCellStatusBarItemProvider {
  provideCellStatusBarItems(
    cell: vscode.NotebookCell,
    _token: vscode.CancellationToken
  ): vscode.NotebookCellStatusBarItem[] {
    if (
      cell.kind === vscode.NotebookCellKind.Code &&
      cell.outputs.length > 0
    ) {
      const item = new vscode.NotebookCellStatusBarItem(
        '$(history) Cached',
        vscode.NotebookCellStatusBarAlignment.Left
      );
      item.tooltip = 'Output was cached in the .mlx file';
      return [item];
    }
    return [];
  }
}
