import JSZip from 'jszip';
import { parseDocument } from './documentParser';
import { parseOutputs, formatOutputs } from './outputParser';
import { MlxCell } from './types';

export interface ParseResult {
  cells: MlxCell[];
  zip: JSZip;
}

export async function parseMlx(content: Uint8Array): Promise<ParseResult> {
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

      // Each region corresponds to one code line in the original document.
      // A code cell with N lines consumes N regions.
      let regionIndex = 0;
      for (const cell of cells) {
        if (cell.kind === 'code') {
          const lineCount = cell.content.split('\n').length;
          const cellOutputs: typeof cell.outputs = [];
          for (let i = 0; i < lineCount; i++) {
            const outputs = outputMap[regionIndex + i];
            if (outputs) cellOutputs.push(...outputs);
          }
          if (cellOutputs.length > 0) {
            cell.outputs = cellOutputs;
          }
          regionIndex += lineCount;
        }
      }
    } catch {
      // Output parsing is best-effort
    }
  }

  return { cells, zip };
}
