import JSZip from 'jszip';
import { parseDocument } from './documentParser';
import { parseOutputs, formatOutputs } from './outputParser';
import { MlxCell } from './types';

export async function parseMlx(content: Uint8Array): Promise<MlxCell[]> {
  const zip = await JSZip.loadAsync(content);

  const docFile = zip.file('matlab/document.xml');
  if (!docFile) {
    throw new Error('Invalid .mlx file: missing matlab/document.xml');
  }

  const docXml = await docFile.async('string');
  const cells = parseDocument(docXml);

  // Try to parse outputs
  const outFile = zip.file('matlab/output.xml');
  if (outFile) {
    try {
      const outXml = await outFile.async('string');
      const outputMap = parseOutputs(outXml);

      // Attach outputs to code cells by region index
      let codeIndex = 0;
      for (const cell of cells) {
        if (cell.kind === 'code') {
          const outputs = outputMap[codeIndex];
          if (outputs && outputs.length > 0) {
            cell.outputs = outputs;
          }
          codeIndex++;
        }
      }
    } catch {
      // Output parsing is best-effort
    }
  }

  return cells;
}
