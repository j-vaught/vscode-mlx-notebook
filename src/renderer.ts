import type { ActivationFunction } from 'vscode-notebook-renderer';

interface MlxOutput {
  type: 'matrix' | 'variable' | string;
  name: string;
  value: string;
  rows: number;
  columns: number;
}

const CSS = `
.mlx-output-container {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  padding: 8px;
}

.mlx-badge {
  display: inline-block;
  background: #466A9F;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  margin-bottom: 8px;
  border-radius: 0;
  text-transform: uppercase;
}

.mlx-output-item {
  margin-bottom: 12px;
}

/* Variable styling */
.mlx-variable {
  line-height: 1.6;
}

body.vscode-light .mlx-var-name {
  color: #73000A;
  font-weight: 600;
}
body.vscode-dark .mlx-var-name {
  color: #CC2E40;
  font-weight: 600;
}

/* Matrix header */
.mlx-matrix-header {
  margin-bottom: 4px;
  font-weight: 600;
}
body.vscode-light .mlx-matrix-header {
  color: #1F414D;
}
body.vscode-dark .mlx-matrix-header {
  color: #A2A2A2;
}
.mlx-matrix-size {
  font-weight: 400;
  opacity: 0.7;
  font-size: 0.9em;
}

/* Table */
.mlx-matrix-table {
  border-collapse: collapse;
  border-radius: 0;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 13px);
}
.mlx-matrix-table td {
  padding: 2px 10px;
  text-align: right;
  border-radius: 0;
}
body.vscode-light .mlx-matrix-table td {
  border: 1px solid #C7C7C7;
}
body.vscode-dark .mlx-matrix-table td {
  border: 1px solid #5C5C5C;
}
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMatrix(output: MlxOutput): string {
  const lines = output.value.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map(line => line.split(/\s+/));

  let html = `<div class="mlx-output-item">`;
  html += `<div class="mlx-matrix-header">${escapeHtml(output.name)} <span class="mlx-matrix-size">(${output.rows}&times;${output.columns})</span></div>`;
  html += `<table class="mlx-matrix-table"><tbody>`;
  for (const row of rows) {
    html += `<tr>`;
    for (const cell of row) {
      html += `<td>${escapeHtml(cell)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  return html;
}

function renderVariable(output: MlxOutput): string {
  return `<div class="mlx-output-item mlx-variable"><span class="mlx-var-name">${escapeHtml(output.name)}</span> = ${escapeHtml(output.value)}</div>`;
}

export const activate: ActivationFunction = (_context) => {
  return {
    renderOutputItem(outputItem, element) {
      const outputs = outputItem.json() as MlxOutput[];

      // Inject styles
      let style = element.querySelector('style.mlx-style');
      if (!style) {
        style = document.createElement('style');
        style.className = 'mlx-style';
        style.textContent = CSS;
        element.appendChild(style);
      }

      const container = document.createElement('div');
      container.className = 'mlx-output-container';

      // Badge
      container.innerHTML = `<span class="mlx-badge">Cached Output</span>`;

      for (const output of outputs) {
        if (output.type === 'matrix' && output.rows > 1) {
          container.innerHTML += renderMatrix(output);
        } else {
          container.innerHTML += renderVariable(output);
        }
      }

      element.appendChild(container);
    },
  };
};
