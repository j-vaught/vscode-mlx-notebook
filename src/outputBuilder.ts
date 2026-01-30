import { MlxOutput } from './types';

export interface CellOutputData {
  outputs: MlxOutput[];
  figures?: Array<{data: string}>;
  text?: string;
}

export function buildOutputXml(cells: Array<{kind: 'code' | 'markup'; content: string; executionOutputs?: CellOutputData}>): string {
  let outputElements = '';
  let regionElements = '';
  const outputIndexMap = new Map<number, number[]>();
  let outputCounter = 0;

  for (const cell of cells) {
    if (cell.kind === 'code') {
      const lines = cell.content.split('\n');
      const lineCount = lines.length;
      const cellOutputIndices: number[] = [];

      // Process execution outputs if present
      if (cell.executionOutputs) {
        // Process MlxOutput items
        for (const output of cell.executionOutputs.outputs) {
          outputElements += `  <element><type>variable</type><outputData><name>${escapeXml(output.name)}</name><value>${escapeXml(output.value)}</value><rows>${output.rows}</rows><columns>${output.columns}</columns></outputData></element>\n`;
          cellOutputIndices.push(outputCounter);
          outputCounter++;
        }

        // Process figure items
        if (cell.executionOutputs.figures) {
          for (const figure of cell.executionOutputs.figures) {
            outputElements += `  <element><type>figure</type><figureUri>data:image/png;base64,${figure.data}</figureUri></element>\n`;
            cellOutputIndices.push(outputCounter);
            outputCounter++;
          }
        }

        // Process text items
        if (cell.executionOutputs.text) {
          outputElements += `  <element><type>text</type><text>${escapeXml(cell.executionOutputs.text)}</text></element>\n`;
          cellOutputIndices.push(outputCounter);
          outputCounter++;
        }
      }

      // Create regions for each line in the code cell
      for (let i = 0; i < lineCount; i++) {
        if (i === lineCount - 1 && cellOutputIndices.length > 0) {
          // Last line of cell with outputs
          regionElements += '  <element><outputIndexes type="array">';
          for (const idx of cellOutputIndices) {
            regionElements += `<element>${idx}</element>`;
          }
          regionElements += '</outputIndexes></element>\n';
        } else {
          // Lines without outputs
          regionElements += '  <element><outputIndexes type="array"/></element>\n';
        }
      }
    }
  }

  // Build the complete XML document
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<embeddedOutputs>\n';
  xml += '  <metaData/>\n';
  xml += '  <outputArray type="array">\n';
  xml += outputElements;
  xml += '  </outputArray>\n';
  xml += '  <regionArray type="array">\n';
  xml += regionElements;
  xml += '  </regionArray>\n';
  xml += '</embeddedOutputs>\n';

  return xml;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
