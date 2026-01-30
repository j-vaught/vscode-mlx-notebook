import * as vscode from 'vscode';
import { parseMlx } from './parser';
import { formatOutputs } from './outputParser';

export class MlxNotebookSerializer implements vscode.NotebookSerializer {
  private originalContent = new WeakMap<vscode.NotebookDocument, Uint8Array>();

  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const cells = await parseMlx(content);

    const cellData: vscode.NotebookCellData[] = cells.map(cell => {
      if (cell.kind === 'code') {
        const cellObj = new vscode.NotebookCellData(
          vscode.NotebookCellKind.Code,
          cell.content,
          'matlab'
        );

        if (cell.outputs && cell.outputs.length > 0) {
          const text = formatOutputs(cell.outputs);
          cellObj.outputs = [
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.json(cell.outputs, 'application/mlx-output+json'),
              vscode.NotebookCellOutputItem.text(text, 'text/plain'),
            ]),
          ];
        }

        return cellObj;
      }

      return new vscode.NotebookCellData(
        vscode.NotebookCellKind.Markup,
        cell.content,
        'markdown'
      );
    });

    const notebook = new vscode.NotebookData(cellData);
    notebook.metadata = { originalContent: content };
    return notebook;
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    // Read-only: return original bytes
    const original = data.metadata?.originalContent;
    if (original instanceof Uint8Array) {
      return original;
    }
    return new Uint8Array();
  }
}
