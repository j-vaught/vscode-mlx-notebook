import * as vscode from 'vscode';
import { MlxNotebookSerializer } from './serializer';
import { MlxCellStatusBarProvider } from './statusBarProvider';
import { MatlabEngine, createEngine, EngineBackend, MatlabResult } from './engine/matlabEngine';

let engine: MatlabEngine | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'mlx-notebook',
      new MlxNotebookSerializer()
    )
  );

  const controller = vscode.notebooks.createNotebookController(
    'mlx-matlab',
    'mlx-notebook',
    'MATLAB'
  );
  controller.supportedLanguages = ['matlab'];
  controller.supportsExecutionOrder = true;

  let executionOrder = 0;

  controller.executeHandler = async (cells, notebook, ctrl) => {
    for (const cell of cells) {
      const exec = ctrl.createNotebookCellExecution(cell);
      exec.executionOrder = ++executionOrder;
      exec.start(Date.now());

      try {
        if (!engine || !engine.isRunning()) {
          const config = vscode.workspace.getConfiguration('mlx-notebook');
          const backend = (config.get<string>('executionBackend') || 'cli') as EngineBackend;
          const matlabPath = config.get<string>('matlabPath') || '';
          engine = createEngine(backend, matlabPath);
          await engine.start();
        }

        const result: MatlabResult = await engine.execute(cell.document.getText());

        const outputItems: vscode.NotebookCellOutputItem[] = [];
        const jsonPayload: Record<string, unknown> = { outputs: [], source: 'live' };

        // Text output
        if (result.stdout) {
          outputItems.push(vscode.NotebookCellOutputItem.text(result.stdout, 'text/plain'));
          (jsonPayload as any).text = result.stdout;
        }

        // Figure outputs
        if (result.figures && result.figures.length > 0) {
          (jsonPayload as any).figures = result.figures;
          for (const fig of result.figures) {
            const bytes = Buffer.from(fig.data, 'base64');
            outputItems.push(new vscode.NotebookCellOutputItem(bytes, 'image/png'));
          }
        }

        // Add JSON output for renderer
        outputItems.unshift(
          vscode.NotebookCellOutputItem.json(jsonPayload, 'application/mlx-output+json')
        );

        // Stderr as error
        if (result.stderr) {
          exec.replaceOutput([
            new vscode.NotebookCellOutput(outputItems),
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.stderr(result.stderr),
            ]),
          ]);
        } else {
          exec.replaceOutput([new vscode.NotebookCellOutput(outputItems)]);
        }

        exec.end(true, Date.now());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        exec.replaceOutput([
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.stderr(message),
          ]),
        ]);
        exec.end(false, Date.now());
      }
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

export function deactivate() {
  if (engine) {
    engine.stop().catch(() => {});
    engine = undefined;
  }
}
