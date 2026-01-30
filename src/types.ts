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
