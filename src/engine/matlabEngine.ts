export interface MatlabResult {
  stdout: string;
  stderr: string;
  figures?: Array<{ data: string }>;  // base64 PNG
}

export interface MatlabEngine {
  start(): Promise<void>;
  execute(code: string): Promise<MatlabResult>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export type EngineBackend = 'cli' | 'python-engine';

export function createEngine(backend: EngineBackend, matlabPath: string): MatlabEngine {
  switch (backend) {
    case 'python-engine':
      // Dynamic import to avoid loading when not needed
      const { PythonEngine } = require('./pythonEngine');
      return new PythonEngine();
    case 'cli':
    default:
      const { CliBackend } = require('./cliBackend');
      return new CliBackend(matlabPath);
  }
}
