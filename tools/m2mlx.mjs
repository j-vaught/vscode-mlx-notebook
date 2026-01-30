#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * Convert a MATLAB .m file (with %% section markers) to a .mlx file (ZIP with document.xml)
 */

function parseMatFile(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;

  // Split on %% markers
  for (const line of lines) {
    if (line.startsWith('%%')) {
      if (current) sections.push(current);
      current = { title: line.substring(2).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  // Classify and process each section
  for (const sec of sections) {
    // Remove leading/trailing blank lines
    while (sec.lines.length && sec.lines[0].trim() === '') sec.lines.shift();
    while (sec.lines.length && sec.lines[sec.lines.length - 1].trim() === '') sec.lines.pop();

    // Check if all lines are comments (or blank)
    const allComments = sec.lines.every(l => l.trim() === '' || l.startsWith('%'));

    if (allComments && sec.lines.length > 0) {
      sec.kind = 'markup';
      // Strip % prefix from each line
      sec.content = sec.lines
        .map(l => {
          if (l.startsWith('% ')) return l.substring(2);
          if (l === '%') return '';
          if (l.startsWith('%')) return l.substring(1);
          return l;
        })
        .join('\n');
      // Prepend title as heading
      if (sec.title) {
        sec.content = '## ' + sec.title + '\n\n' + sec.content;
      }
    } else {
      sec.kind = 'code';
      sec.content = sec.lines.join('\n');
    }
  }

  return sections;
}

function escapeCDATA(text) {
  // In CDATA, ]]> is not allowed. Replace with ]]]]><![CDATA[>
  return text.replace(/]]>/g, ']]]]><![CDATA[>');
}

function createDocumentXML(sections) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n';
  xml += '<w:body>\n';

  let lastKind = null;

  for (const sec of sections) {
    // Insert section break between transitions
    if (lastKind && lastKind !== sec.kind) {
      xml += '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>\n';
    }

    if (sec.kind === 'markup') {
      // Markup cell: split by lines and process as markdown
      const contentLines = sec.content.split('\n');
      for (const line of contentLines) {
        if (line.startsWith('## ')) {
          // Heading
          const text = line.substring(3);
          xml += '<w:p><w:pPr><w:pStyle w:val="heading"/></w:pPr><w:r><w:t><![CDATA[';
          xml += escapeCDATA(text);
          xml += ']]></w:t></w:r></w:p>\n';
        } else {
          // Regular text
          xml += '<w:p><w:pPr><w:pStyle w:val="text"/></w:pPr><w:r><w:t><![CDATA[';
          xml += escapeCDATA(line);
          xml += ']]></w:t></w:r></w:p>\n';
        }
      }
    } else {
      // Code cell: each line is a code line
      const contentLines = sec.content.split('\n');
      for (const line of contentLines) {
        xml += '<w:p><w:pPr><w:pStyle w:val="code"/></w:pPr><w:r><w:t><![CDATA[';
        xml += escapeCDATA(line);
        xml += ']]></w:t></w:r></w:p>\n';
      }
    }

    lastKind = sec.kind;
  }

  xml += '</w:body>\n';
  xml += '</w:document>\n';
  return xml;
}

async function convertMatToMLX(inputFile, outputFile) {
  try {
    // Read the .m file
    const content = fs.readFileSync(inputFile, 'utf8');

    // Parse into sections
    const sections = parseMatFile(content);

    // Generate document.xml
    const documentXML = createDocumentXML(sections);

    // Create ZIP with jszip
    const zip = new JSZip();
    zip.folder('matlab').file('document.xml', documentXML);

    // Write ZIP to file
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(outputFile, buffer);

    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node m2mlx.mjs <input.m> <output.mlx>');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

convertMatToMLX(inputFile, outputFile);
