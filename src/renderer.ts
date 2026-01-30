import type { ActivationFunction } from 'vscode-notebook-renderer';

interface MlxOutput {
  type: 'matrix' | 'variable' | string;
  name: string;
  value: string;
  rows: number;
  columns: number;
}

interface MlxOutputPayload {
  outputs?: MlxOutput[];
  figures?: Array<{ data: string }>;
  text?: string;
  source?: 'cached' | 'live';
}

const CSS = `
.mlx-output-container {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  padding: 12px;
  border: 1px solid var(--vscode-panel-border, #C7C7C7);
  background: var(--vscode-editor-background);
}

.mlx-badge {
  display: inline-block;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  margin-bottom: 10px;
  border-radius: 0;
  text-transform: uppercase;
}

.mlx-badge-cached {
  background: #676156;
}

.mlx-badge-live {
  background: #65780B;
}

.mlx-badge-stale {
  background: #A49137;
}

.mlx-output-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vscode-panel-border, #ECECEC);
}
.mlx-output-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
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
  margin-bottom: 6px;
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
body.vscode-light .mlx-matrix-table {
  border: 1px solid #C7C7C7;
}
body.vscode-dark .mlx-matrix-table {
  border: 1px solid #5C5C5C;
}
.mlx-matrix-table td {
  padding: 3px 12px;
  text-align: right;
  border-radius: 0;
}
body.vscode-light .mlx-matrix-table td {
  border: 1px solid #C7C7C7;
}
body.vscode-dark .mlx-matrix-table td {
  border: 1px solid #5C5C5C;
}

/* Figure */
.mlx-figure {
  margin: 8px 0;
  border: 1px solid var(--vscode-panel-border, #C7C7C7);
  display: inline-block;
}
.mlx-figure img {
  max-width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.15s;
}
.mlx-figure img:hover {
  opacity: 0.85;
}

/* Figure zoom overlay */
.mlx-figure-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  cursor: zoom-out;
}
.mlx-figure-overlay img {
  max-width: 95%;
  max-height: 95%;
  border: 2px solid #FFFFFF;
}

/* Text output */
.mlx-text-output {
  white-space: pre-wrap;
  margin: 4px 0;
  padding: 8px;
  background: var(--vscode-textBlockQuote-background, #F5F5F5);
  border-left: 3px solid #676156;
  font-family: var(--vscode-editor-font-family, monospace);
}

/* Error output */
.mlx-error-output {
  white-space: pre-wrap;
  margin: 4px 0;
  padding: 8px;
  background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  border-left: 3px solid #73000A;
  color: #CC2E40;
  font-family: var(--vscode-editor-font-family, monospace);
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

function renderFigure(base64Data: string, index: number): string {
  let src = base64Data;
  if (!src.startsWith('data:')) {
    src = `data:image/png;base64,${src}`;
  }
  return `<div class="mlx-output-item mlx-figure"><img src="${src}" data-fig-idx="${index}" title="Click to zoom" /></div>`;
}

function renderText(text: string): string {
  return `<div class="mlx-output-item mlx-text-output">${escapeHtml(text)}</div>`;
}

export const activate: ActivationFunction = (_context) => {
  return {
    renderOutputItem(outputItem, element) {
      const payload = outputItem.json() as MlxOutputPayload;

      // Handle legacy format (plain array of MlxOutput)
      const outputs: MlxOutput[] = Array.isArray(payload) ? payload : (payload.outputs || []);
      const figures = Array.isArray(payload) ? undefined : payload.figures;
      const text = Array.isArray(payload) ? undefined : payload.text;
      const source = Array.isArray(payload) ? 'cached' : (payload.source || 'cached');

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
      const badgeClass = source === 'live' ? 'mlx-badge-live' : 'mlx-badge-cached';
      const badgeLabel = source === 'live' ? 'Live Output' : 'Cached Output';
      container.innerHTML = `<span class="mlx-badge ${badgeClass}">${badgeLabel}</span>`;

      // Render text output
      if (text) {
        container.innerHTML += renderText(text);
      }

      // Render structured outputs
      for (const output of outputs) {
        if (output.type === 'matrix' && output.rows > 1) {
          container.innerHTML += renderMatrix(output);
        } else {
          container.innerHTML += renderVariable(output);
        }
      }

      // Render figures with zoom-on-click
      if (figures) {
        for (let i = 0; i < figures.length; i++) {
          container.innerHTML += renderFigure(figures[i].data, i);
        }
      }

      element.appendChild(container);

      // Attach zoom-on-click handlers to figures
      const figImages = container.querySelectorAll('.mlx-figure img') as NodeListOf<HTMLImageElement>;
      for (const img of figImages) {
        img.addEventListener('click', () => {
          const overlay = document.createElement('div');
          overlay.className = 'mlx-figure-overlay';
          const zoomed = document.createElement('img');
          zoomed.src = img.src;
          overlay.appendChild(zoomed);
          overlay.addEventListener('click', () => overlay.remove());
          document.body.appendChild(overlay);
        });
      }
    },
  };
};
