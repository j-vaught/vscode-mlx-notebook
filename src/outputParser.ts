import { XMLParser } from 'fast-xml-parser';
import { MlxOutput, OutputMap } from './types';

interface OutputElement {
  type?: string;
  outputData?: {
    name?: string;
    value?: string;
    rows?: string | number;
    columns?: string | number;
  };
  lineNumbers?: { element?: string | string[] };
}

interface OutputIndexes {
  element?: string | string[];
  '@_type'?: string;
}

interface RegionElement {
  outputIndexes?: OutputIndexes;
}

function extractIndexes(oi: OutputIndexes | undefined): number[] {
  if (!oi) return [];
  const el = oi.element;
  if (el === undefined || el === null) return [];
  if (Array.isArray(el)) return el.map(s => parseInt(String(s), 10)).filter(n => !isNaN(n));
  return [parseInt(String(el), 10)].filter(n => !isNaN(n));
}

export function parseOutputs(xml: string): OutputMap {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml);
  const map: OutputMap = {};

  // Root can be embeddedOutputs or outputData
  const root = doc?.embeddedOutputs || doc?.outputData;
  if (!root) return map;

  const outputArray = root?.outputArray?.element;
  if (!outputArray) return map;

  const elements: OutputElement[] = Array.isArray(outputArray) ? outputArray : [outputArray];

  const regionArray = root?.regionArray?.element;
  const regions: RegionElement[] = regionArray
    ? (Array.isArray(regionArray) ? regionArray : [regionArray])
    : [];

  for (let regionIdx = 0; regionIdx < regions.length; regionIdx++) {
    const region = regions[regionIdx];
    const outputIdxs = extractIndexes(region.outputIndexes);

    const outputs: MlxOutput[] = [];
    for (const oi of outputIdxs) {
      if (oi < 0 || oi >= elements.length) continue;
      const el = elements[oi];
      const od = el.outputData;
      if (!od) continue;
      outputs.push({
        type: el.type || 'variable',
        name: od.name || '',
        value: String(od.value ?? ''),
        rows: Number(od.rows) || 0,
        columns: Number(od.columns) || 0,
      });
    }

    if (outputs.length > 0) {
      map[regionIdx] = outputs;
    }
  }

  return map;
}

export function formatOutput(output: MlxOutput): string {
  if (output.type === 'matrix' && output.rows > 1) {
    return `${output.name} =\n\n${output.value}`;
  }
  return `${output.name} = ${output.value}`;
}

export function formatOutputs(outputs: MlxOutput[]): string {
  return outputs.map(formatOutput).join('\n\n');
}
