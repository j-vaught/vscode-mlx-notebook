export interface MlxCell {
  kind: 'code' | 'markup';
  content: string;
  outputs?: MlxOutput[];
}

export interface MlxOutput {
  type: 'matrix' | 'variable' | string;
  name: string;
  value: string;
  rows: number;
  columns: number;
}

export interface OutputMap {
  [codeRegionIndex: number]: MlxOutput[];
}

export interface MlxExecutionResult {
  stdout: string;
  stderr: string;
  figures?: Array<{ data: string }>;
}

export interface MlxCellOutputMeta {
  source: 'cached' | 'live';
}
