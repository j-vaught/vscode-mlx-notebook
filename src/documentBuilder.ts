/**
 * Builds WordprocessingML document XML from VS Code notebook cells
 * for saving as MATLAB .mlx files
 */

interface NotebookCell {
  kind: 'code' | 'markup';
  content: string;
}

/**
 * Escapes special XML characters in text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parses markdown formatting within text and returns array of runs
 * Each run has content and optional formatting (bold, italic)
 */
function parseMarkdownRuns(text: string): Array<{ content: string; bold: boolean; italic: boolean }> {
  const runs: Array<{ content: string; bold: boolean; italic: boolean }> = [];
  let currentIndex = 0;

  // Pattern to match **bold**, *italic*, or plain text
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|([^\*]+)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      // Bold text
      runs.push({ content: match[1], bold: true, italic: false });
    } else if (match[2]) {
      // Italic text
      runs.push({ content: match[2], bold: false, italic: true });
    } else if (match[3]) {
      // Plain text
      runs.push({ content: match[3], bold: false, italic: false });
    }
  }

  return runs.length > 0 ? runs : [{ content: text, bold: false, italic: false }];
}

/**
 * Builds a WordprocessingML run element with optional formatting
 */
function buildRun(text: string, bold: boolean = false, italic: boolean = false): string {
  const escapedText = escapeXml(text);
  const rprOpen = bold || italic ? '<w:rPr>' : '';
  const boldTag = bold ? '<w:b/>' : '';
  const italicTag = italic ? '<w:u/>' : '';
  const rprClose = bold || italic ? '</w:rPr>' : '';

  return `<w:r>${rprOpen}${boldTag}${italicTag}${rprClose}<w:t xml:space="preserve">${escapedText}</w:t></w:r>`;
}

/**
 * Builds a paragraph element with specified style
 */
function buildParagraph(content: string, style: string, isCodeLine: boolean = false): string {
  let runsXml = '';

  if (isCodeLine) {
    // Code lines use CDATA wrapping
    const escapedContent = content.replace(/\]\]>/g, ']]]]><![CDATA[>');
    runsXml = `<w:r><w:t xml:space="preserve"><![CDATA[${escapedContent}]]></w:t></w:r>`;
  } else {
    // Markup lines parse markdown formatting
    const runs = parseMarkdownRuns(content);
    runsXml = runs.map(run => buildRun(run.content, run.bold, run.italic)).join('');
  }

  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runsXml}</w:p>`;
}

/**
 * Builds a section break paragraph
 */
function buildSectionBreak(): string {
  return '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>';
}

/**
 * Determines the paragraph style for a markup line
 */
function getMarkupStyle(line: string): string {
  if (line.startsWith('# ')) {
    return 'title';
  } else if (line.startsWith('## ')) {
    return 'heading';
  } else if (line.startsWith('### ')) {
    return 'heading2';
  }
  return 'text';
}

/**
 * Removes markdown heading markers from a line
 */
function removeHeadingMarker(line: string): string {
  return line.replace(/^#+\s+/, '');
}

/**
 * Generates WordprocessingML document XML from notebook cells
 */
export function buildDocumentXml(cells: Array<{ kind: 'code' | 'markup'; content: string }>): string {
  let bodyXml = '';
  let previousKind: 'code' | 'markup' | null = null;

  for (const cell of cells) {
    // Insert section break between code↔markup transitions
    if (previousKind !== null && previousKind !== cell.kind) {
      bodyXml += buildSectionBreak();
    }

    if (cell.kind === 'code') {
      // Split code content by lines and create paragraph for each
      const lines = cell.content.split('\n');
      for (const line of lines) {
        bodyXml += buildParagraph(line, 'code', true);
      }
    } else {
      // Markup cell: parse as markdown
      const lines = cell.content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          // Empty lines become empty paragraphs
          bodyXml += '<w:p><w:pPr><w:pStyle w:val="text"/></w:pPr></w:p>';
        } else {
          const style = getMarkupStyle(line);
          const content = style !== 'text' ? removeHeadingMarker(line) : line;
          bodyXml += buildParagraph(content, style, false);
        }
      }
    }

    previousKind = cell.kind;
  }

  // Wrap in WordprocessingML document structure
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;

  return xml;
}
