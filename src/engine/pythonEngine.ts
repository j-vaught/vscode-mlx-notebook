import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { MatlabEngine, MatlabResult } from './matlabEngine';

export class PythonEngine implements MatlabEngine {
  private process: ChildProcess | null = null;
  private running: boolean = false;
  private ready: boolean = false;
  private inputBuffer: string = '';

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    const bridgeScript = path.join(__dirname, 'matlab_bridge.py');

    return new Promise((resolve, reject) => {
      this.process = spawn('python3', ['-u', bridgeScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stderr) {
        reject(new Error('Failed to create stdout/stderr streams'));
        return;
      }

      let readyReceived = false;

      const onStdout = (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const msg = JSON.parse(line);
            if (msg.status === 'ready' && !readyReceived) {
              readyReceived = true;
              this.ready = true;
              this.running = true;
              this.process!.stdout?.removeListener('data', onStdout);
              resolve();
            }
          } catch (e) {
            // JSON parse error, ignore startup messages
          }
        }
      };

      const onError = (error: Error) => {
        reject(new Error(`Failed to spawn Python bridge: ${error.message}`));
      };

      const onClose = () => {
        if (!readyReceived) {
          reject(new Error('Python bridge process closed before ready'));
        }
      };

      this.process.on('error', onError);
      this.process.once('close', onClose);
      this.process.stdout.on('data', onStdout);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!readyReceived) {
          reject(new Error('Python bridge startup timeout'));
        }
      }, 10000);
    });
  }

  async execute(code: string): Promise<MatlabResult> {
    if (!this.running || !this.ready || !this.process?.stdin) {
      throw new Error('Engine not started. Call start() first.');
    }

    return new Promise((resolve, reject) => {
      const command = {
        action: 'execute',
        code: code,
      };

      let resultReceived = false;

      const onStdout = (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const result = JSON.parse(line);
            if (result.error) {
              resultReceived = true;
              this.process!.stdout?.removeListener('data', onStdout);
              reject(new Error(result.error));
            } else if (result.stdout !== undefined || result.stderr !== undefined) {
              resultReceived = true;
              this.process!.stdout?.removeListener('data', onStdout);
              resolve({
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                figures: result.figures || undefined,
              });
            }
          } catch (e) {
            // JSON parse error, skip
          }
        }
      };

      this.process!.stdout!.on('data', onStdout);

      // Write command
      try {
        this.process!.stdin!.write(JSON.stringify(command) + '\n');
      } catch (e) {
        reject(new Error(`Failed to write command: ${e instanceof Error ? e.message : String(e)}`));
      }

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!resultReceived) {
          this.process!.stdout?.removeListener('data', onStdout);
          reject(new Error('Execution timeout'));
        }
      }, 60000);
    });
  }

  async stop(): Promise<void> {
    if (!this.running || !this.process?.stdin) {
      return;
    }

    return new Promise((resolve) => {
      const command = { action: 'quit' };

      const onClose = () => {
        this.running = false;
        this.ready = false;
        this.process = null;
        resolve();
      };

      this.process!.once('close', onClose);

      try {
        this.process!.stdin!.write(JSON.stringify(command) + '\n');
      } catch (e) {
        // If write fails, just kill the process
        this.process!.kill();
        onClose();
      }

      // Force kill after 5 seconds if not closed
      setTimeout(() => {
        if (this.process) {
          this.process.kill();
        }
        onClose();
      }, 5000);
    });
  }

  isRunning(): boolean {
    return this.running && this.ready;
  }
}
