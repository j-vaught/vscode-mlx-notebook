import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(__dirname, 'fixtures', 'sample.mlx');

// Also test HW file if available
const hwPath = '/Volumes/MacShare/graduate-coursework/Sp26/EMCH792/HW1/ws/HW_1_manual.mlx';

// Import the built modules - we test against the source logic directly
// Since the extension bundles for vscode, we replicate the key logic here

function buildDocumentXml(cells) {
  function escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseMarkdownRuns(text) {
    const runs = [];
    const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) runs.push({ content: match[1], bold: true, italic: false });
      else if (match[2]) runs.push({ content: match[2], bold: false, italic: true });
      else if (match[3]) runs.push({ content: match[3], bold: false, italic: false });
    }
    return runs.length > 0 ? runs : [{ content: text, bold: false, italic: false }];
  }

  function buildRun(text, bold, italic) {
    const escaped = escapeXml(text);
    const rprOpen = bold || italic ? '<w:rPr>' : '';
    const boldTag = bold ? '<w:b/>' : '';
    const italicTag = italic ? '<w:u/>' : '';
    const rprClose = bold || italic ? '</w:rPr>' : '';
    return `<w:r>${rprOpen}${boldTag}${italicTag}${rprClose}<w:t xml:space="preserve">${escaped}</w:t></w:r>`;
  }

  let bodyXml = '';
  let previousKind = null;

  for (const cell of cells) {
    if (previousKind !== null && previousKind !== cell.kind) {
      bodyXml += '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>';
    }

    if (cell.kind === 'code') {
      const lines = cell.content.split('\n');
      for (const line of lines) {
        const escaped = line.replace(/\]\]>/g, ']]]]><![CDATA[>');
        bodyXml += `<w:p><w:pPr><w:pStyle w:val="code"/></w:pPr><w:r><w:t xml:space="preserve"><![CDATA[${escaped}]]></w:t></w:r></w:p>`;
      }
    } else {
      const lines = cell.content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          bodyXml += '<w:p><w:pPr><w:pStyle w:val="text"/></w:pPr></w:p>';
        } else {
          let style = 'text';
          let content = line;
          if (line.startsWith('### ')) { style = 'heading2'; content = line.slice(4); }
          else if (line.startsWith('## ')) { style = 'heading'; content = line.slice(3); }
          else if (line.startsWith('# ')) { style = 'title'; content = line.slice(2); }

          const runs = parseMarkdownRuns(content);
          const runsXml = runs.map(r => buildRun(r.content, r.bold, r.italic)).join('');
          bodyXml += `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runsXml}</w:p>`;
        }
      }
    }
    previousKind = cell.kind;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
}

// --- Document parser (mirrors src/documentParser.ts) ---
function parseDocument(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_',
    cdataPropName: '__cdata', preserveOrder: false,
    parseTagValue: false, trimValues: false,
  });
  const doc = parser.parse(xml);
  const body = doc?.['w:document']?.['w:body'];
  if (!body) return [];
  let paragraphs = body['w:p'];
  if (!paragraphs) return [];
  if (!Array.isArray(paragraphs)) paragraphs = [paragraphs];

  const cells = [];
  let pendingMarkup = [];

  function flushMarkup() {
    if (pendingMarkup.length > 0) {
      cells.push({ kind: 'markup', content: pendingMarkup.join('\n') });
      pendingMarkup = [];
    }
  }

  function getTextFromRun(run) {
    const t = run['w:t'];
    if (t === undefined || t === null) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object') {
      if ('__cdata' in t && t.__cdata !== undefined) return String(t.__cdata);
      if ('#text' in t && t['#text'] !== undefined) return String(t['#text']);
    }
    return String(t);
  }

  function formatRun(run) {
    const text = getTextFromRun(run);
    if (!text) return '';
    const rPr = run['w:rPr'];
    if (!rPr) return text;
    let result = text;
    if (rPr['w:b'] !== undefined) result = `**${result}**`;
    if (rPr['w:u'] !== undefined) result = `*${result}*`;
    return result;
  }

  function getStyle(p) {
    const direct = p['w:pPr']?.['w:pStyle']?.['@_w:val'];
    if (direct) return direct;
    const fallback = p['mc:AlternateContent']?.['mc:Fallback']?.['w:pPr']?.['w:pStyle']?.['@_w:val'];
    return fallback || 'text';
  }

  function getRuns(p) {
    if (!p['w:r']) return [];
    return Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']];
  }

  for (const p of paragraphs) {
    const pPr = p['w:pPr'];
    if (pPr?.['w:sectPr'] !== undefined && !pPr['w:pStyle'] && !p['w:r']) continue;
    const style = getStyle(p);
    if (style === 'code') {
      flushMarkup();
      cells.push({ kind: 'code', content: getRuns(p).map(getTextFromRun).join('') });
    } else {
      let text = getRuns(p).map(formatRun).join('');
      if (style === 'title') text = `# ${text}`;
      else if (style === 'heading') text = `## ${text}`;
      else if (style === 'heading2') text = `### ${text}`;
      pendingMarkup.push(text);
    }
  }
  flushMarkup();

  // Merge adjacent code
  const merged = [];
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

// ============ TESTS ============

let errors = 0;
let passed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

async function testRoundTrip(filePath, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Round-trip test: ${label}`);
  console.log('='.repeat(60));

  let buf;
  try {
    buf = readFileSync(filePath);
  } catch {
    console.log(`  SKIP: File not found at ${filePath}`);
    return;
  }

  if (buf.length === 0) {
    console.log(`  SKIP: File is empty (0 bytes)`);
    return;
  }

  // Step 1: Parse original .mlx
  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    console.log(`  SKIP: Invalid ZIP - ${e.message}`);
    return;
  }
  const docXml = await zip.file('matlab/document.xml').async('string');
  const originalCells = parseDocument(docXml);

  console.log(`  Original cells: ${originalCells.length}`);
  assert(originalCells.length > 0, 'Has cells');

  const codeCells = originalCells.filter(c => c.kind === 'code');
  const markupCells = originalCells.filter(c => c.kind === 'markup');
  console.log(`  Code: ${codeCells.length}, Markup: ${markupCells.length}`);

  // Step 2: Build new document.xml from cells
  const newDocXml = buildDocumentXml(originalCells);
  assert(newDocXml.includes('<?xml'), 'Generated XML has declaration');
  assert(newDocXml.includes('<w:document'), 'Generated XML has document root');
  assert(newDocXml.includes('<w:body>'), 'Generated XML has body');

  // Step 3: Parse the generated XML back
  const roundTripCells = parseDocument(newDocXml);
  console.log(`  Round-trip cells: ${roundTripCells.length}`);

  assert(roundTripCells.length === originalCells.length,
    `Cell count matches: ${roundTripCells.length} === ${originalCells.length}`);

  // Step 4: Compare cell kinds
  let kindMismatch = 0;
  for (let i = 0; i < Math.min(originalCells.length, roundTripCells.length); i++) {
    if (originalCells[i].kind !== roundTripCells[i].kind) {
      console.error(`    Cell ${i}: kind mismatch: ${originalCells[i].kind} vs ${roundTripCells[i].kind}`);
      kindMismatch++;
    }
  }
  assert(kindMismatch === 0, 'All cell kinds match');

  // Step 5: Compare code cell content
  let contentMismatch = 0;
  for (let i = 0; i < Math.min(originalCells.length, roundTripCells.length); i++) {
    if (originalCells[i].kind === 'code') {
      if (originalCells[i].content !== roundTripCells[i].content) {
        console.error(`    Code cell ${i}: content mismatch`);
        console.error(`      Original:   "${originalCells[i].content.substring(0, 80)}"`);
        console.error(`      RoundTrip:  "${roundTripCells[i].content.substring(0, 80)}"`);
        contentMismatch++;
      }
    }
  }
  assert(contentMismatch === 0, 'All code cell content matches');

  // Step 6: Compare markup cell content
  let markupMismatch = 0;
  for (let i = 0; i < Math.min(originalCells.length, roundTripCells.length); i++) {
    if (originalCells[i].kind === 'markup') {
      if (originalCells[i].content !== roundTripCells[i].content) {
        console.error(`    Markup cell ${i}: content mismatch`);
        console.error(`      Original:   "${originalCells[i].content.substring(0, 80)}"`);
        console.error(`      RoundTrip:  "${roundTripCells[i].content.substring(0, 80)}"`);
        markupMismatch++;
      }
    }
  }
  assert(markupMismatch === 0, 'All markup cell content matches');

  // Step 7: Test ZIP round-trip (clone zip, replace document.xml, re-read)
  const originalBytes = await zip.generateAsync({ type: 'uint8array' });
  const clonedZip = await JSZip.loadAsync(originalBytes);
  clonedZip.file('matlab/document.xml', newDocXml);

  const savedBytes = await clonedZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Verify the saved zip is valid
  const reloadedZip = await JSZip.loadAsync(savedBytes);
  const reloadedDoc = await reloadedZip.file('matlab/document.xml').async('string');
  const reloadedCells = parseDocument(reloadedDoc);

  assert(reloadedCells.length === originalCells.length,
    `ZIP round-trip cell count: ${reloadedCells.length} === ${originalCells.length}`);

  // Verify other files preserved
  const originalFiles = Object.keys(zip.files).filter(f => !f.endsWith('/')).sort();
  const reloadedFiles = Object.keys(reloadedZip.files).filter(f => !f.endsWith('/')).sort();
  assert(JSON.stringify(originalFiles) === JSON.stringify(reloadedFiles),
    `ZIP file entries preserved: ${reloadedFiles.length} files`);

  // Write test output for manual inspection
  const outPath = join(__dirname, 'fixtures', `${label.replace(/[^a-zA-Z0-9]/g, '_')}_roundtrip.mlx`);
  writeFileSync(outPath, Buffer.from(savedBytes));
  console.log(`  Wrote: ${outPath}`);
}

async function testDocumentBuilder() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Document builder unit tests');
  console.log('='.repeat(60));

  // Test basic code cell
  const xml1 = buildDocumentXml([{ kind: 'code', content: 'x = 1;\ny = 2;' }]);
  assert(xml1.includes('w:val="code"'), 'Code cell has code style');
  assert((xml1.match(/w:val="code"/g) || []).length === 2, 'Two code lines = two code paragraphs');

  // Test markup cell with headings
  const xml2 = buildDocumentXml([{ kind: 'markup', content: '# Title\n## Heading\n### Heading2\nPlain text' }]);
  assert(xml2.includes('w:val="title"'), 'Title style present');
  assert(xml2.includes('w:val="heading"'), 'Heading style present');
  assert(xml2.includes('w:val="heading2"'), 'Heading2 style present');
  assert(xml2.includes('w:val="text"'), 'Text style present');

  // Test section breaks between code and markup
  const xml3 = buildDocumentXml([
    { kind: 'markup', content: '# Title' },
    { kind: 'code', content: 'x = 1;' },
    { kind: 'markup', content: 'Some text' },
  ]);
  assert((xml3.match(/<w:sectPr\/>/g) || []).length === 2, 'Two section breaks for markup→code→markup');

  // Test bold and italic
  const xml4 = buildDocumentXml([{ kind: 'markup', content: 'This is **bold** and *italic*' }]);
  assert(xml4.includes('<w:b/>'), 'Bold formatting');
  assert(xml4.includes('<w:u/>'), 'Italic (underline) formatting');

  // Test empty markup lines
  const xml5 = buildDocumentXml([{ kind: 'markup', content: 'Line 1\n\nLine 3' }]);
  assert((xml5.match(/w:val="text"/g) || []).length === 3, 'Empty line preserved as text paragraph');
}

async function main() {
  await testDocumentBuilder();
  await testRoundTrip(samplePath, 'sample');
  await testRoundTrip(hwPath, 'HW_1_manual');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${errors} failed`);
  console.log('='.repeat(60));

  if (errors > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
