import { XMLParser } from 'fast-xml-parser';
import { MlxCell } from './types';

const W_NS = 'w:';

interface WRun {
  'w:rPr'?: {
    'w:b'?: unknown;
    'w:u'?: unknown;
  };
  'w:t'?: string | { '#text'?: string; '__cdata'?: string; '@_xml:space'?: string };
}

interface WParagraph {
  'w:pPr'?: {
    'w:pStyle'?: { '@_w:val': string };
  };
  'w:r'?: WRun | WRun[];
  'mc:AlternateContent'?: {
    'mc:Fallback'?: {
      'w:pPr'?: {
        'w:pStyle'?: { '@_w:val': string };
      };
    };
  };
}

function getTextFromRun(run: WRun): string {
  const t = run['w:t'];
  if (t === undefined || t === null) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object') {
    if ('__cdata' in t && t.__cdata) return String(t.__cdata);
    if ('#text' in t && t['#text']) return String(t['#text']);
  }
  return String(t);
}

function formatRun(run: WRun): string {
  const text = getTextFromRun(run);
  if (!text) return '';
  const rPr = run['w:rPr'];
  if (!rPr) return text;
  const bold = rPr['w:b'] !== undefined;
  const underline = rPr['w:u'] !== undefined;
  let result = text;
  if (bold) result = `**${result}**`;
  if (underline) result = `*${result}*`;
  return result;
}

function getStyle(p: WParagraph): string {
  const direct = p['w:pPr']?.['w:pStyle']?.['@_w:val'];
  if (direct) return direct;
  const fallback = p['mc:AlternateContent']?.['mc:Fallback']?.['w:pPr']?.['w:pStyle']?.['@_w:val'];
  return fallback || 'text';
}

function getRuns(p: WParagraph): WRun[] {
  if (!p['w:r']) return [];
  return Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']];
}

function extractText(p: WParagraph): string {
  return getRuns(p).map(formatRun).join('');
}

function extractCode(p: WParagraph): string {
  return getRuns(p).map(getTextFromRun).join('');
}

export function parseDocument(xml: string): MlxCell[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    preserveOrder: false,
    parseTagValue: false,
    trimValues: false,
  });

  const doc = parser.parse(xml);
  const body = doc?.['w:document']?.['w:body'];
  if (!body) return [];

  let paragraphs: WParagraph[] = body['w:p'];
  if (!paragraphs) return [];
  if (!Array.isArray(paragraphs)) paragraphs = [paragraphs];

  const cells: MlxCell[] = [];
  let pendingMarkup: string[] = [];

  function flushMarkup() {
    if (pendingMarkup.length > 0) {
      cells.push({ kind: 'markup', content: pendingMarkup.join('\n') });
      pendingMarkup = [];
    }
  }

  for (const p of paragraphs) {
    // Skip section-break-only paragraphs (w:sectPr with no content)
    const pPr = p['w:pPr'] as Record<string, unknown> | undefined;
    if (pPr?.['w:sectPr'] !== undefined && !pPr['w:pStyle'] && !p['w:r']) continue;

    const style = getStyle(p);

    if (style === 'code') {
      flushMarkup();
      cells.push({ kind: 'code', content: extractCode(p) });
    } else {
      let text = extractText(p);
      if (style === 'title') {
        text = `# ${text}`;
      } else if (style === 'heading') {
        text = `## ${text}`;
      } else if (style === 'heading2') {
        text = `### ${text}`;
      }
      pendingMarkup.push(text);
    }
  }

  flushMarkup();

  // Merge adjacent code cells (multi-line code in separate paragraphs)
  const merged: MlxCell[] = [];
  for (const cell of cells) {
    const prev = merged[merged.length - 1];
    if (cell.kind === 'code' && prev?.kind === 'code') {
      prev.content += '\n' + cell.content;
    } else {
      merged.push({ ...cell });
    }
  }

  return merged;
}
