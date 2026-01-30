export interface MlxCell {
  kind: 'code' | 'markup';
  content: string;
  outputs?: MlxOutput[];
  figures?: MlxFigure[];
  textOutput?: string;
}

export interface MlxOutput {
  type: 'matrix' | 'variable' | string;
  name: string;
  value: string;
  rows: number;
  columns: number;
}

export interface MlxFigure {
  data: string; // base64 PNG or data URI
}

export interface OutputMap {
  [codeRegionIndex: number]: MlxRegionOutputs;
}

export interface MlxRegionOutputs {
  variables: MlxOutput[];
  figures: MlxFigure[];
  text: string[];
}

export interface MlxExecutionResult {
  stdout: string;
  stderr: string;
  figures?: Array<{ data: string }>;
}

export interface MlxCellOutputMeta {
  source: 'cached' | 'live';
}
