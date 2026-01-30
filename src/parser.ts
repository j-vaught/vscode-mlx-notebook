import JSZip from 'jszip';
import { parseDocument } from './documentParser';
import { parseOutputs } from './outputParser';
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
          const cellFigures: typeof cell.figures = [];
          const cellText: string[] = [];

          for (let i = 0; i < lineCount; i++) {
            const region = outputMap[regionIndex + i];
            if (region) {
              if (region.variables.length > 0) cellOutputs.push(...region.variables);
              if (region.figures.length > 0) cellFigures.push(...region.figures);
              if (region.text.length > 0) cellText.push(...region.text);
            }
          }

          if (cellOutputs.length > 0) cell.outputs = cellOutputs;
          if (cellFigures.length > 0) cell.figures = cellFigures;
          if (cellText.length > 0) cell.textOutput = cellText.join('\n');

          regionIndex += lineCount;
        }
      }
    } catch {
      // Output parsing is best-effort
    }
  }

  return { cells, zip };
}
