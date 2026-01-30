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
  lineNumbers?: string | number;
}

interface RegionElement {
  outputIndexes?: string;
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

  const outputArray = doc?.outputData?.outputArray?.element;
  if (!outputArray) return map;

  const elements: OutputElement[] = Array.isArray(outputArray) ? outputArray : [outputArray];

  const regionArray = doc?.outputData?.regionArray?.element;
  const regions: RegionElement[] = regionArray
    ? (Array.isArray(regionArray) ? regionArray : [regionArray])
    : [];

  // Map region index → output elements
  for (let regionIdx = 0; regionIdx < regions.length; regionIdx++) {
    const region = regions[regionIdx];
    const indexStr = region.outputIndexes;
    if (!indexStr && indexStr !== '0') continue;

    const outputIdxs = String(indexStr).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

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
