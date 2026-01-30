import * as vscode from 'vscode';

export class MlxCellStatusBarProvider implements vscode.NotebookCellStatusBarItemProvider {
  provideCellStatusBarItems(
    cell: vscode.NotebookCell,
    _token: vscode.CancellationToken
  ): vscode.NotebookCellStatusBarItem[] {
    if (cell.kind !== vscode.NotebookCellKind.Code || cell.outputs.length === 0) {
      return [];
    }

    // Check output source
    let source: 'cached' | 'live' = 'cached';
    for (const output of cell.outputs) {
      for (const item of output.items) {
        if (item.mime === 'application/mlx-output+json') {
          try {
            const data = JSON.parse(new TextDecoder().decode(item.data));
            if (data.source === 'live') {
              source = 'live';
            }
          } catch {
            // ignore
          }
        }
      }
    }

    if (source === 'live') {
      const item = new vscode.NotebookCellStatusBarItem(
        '$(play) Live',
        vscode.NotebookCellStatusBarAlignment.Left
      );
      item.tooltip = 'Output from live MATLAB execution';
      return [item];
    }

    const item = new vscode.NotebookCellStatusBarItem(
      '$(history) Cached',
      vscode.NotebookCellStatusBarAlignment.Left
    );
    item.tooltip = 'Output was cached in the .mlx file';
    return [item];
  }
}
