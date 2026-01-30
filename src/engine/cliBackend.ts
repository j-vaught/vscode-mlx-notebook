import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MatlabEngine, MatlabResult } from './matlabEngine';

export class CliBackend implements MatlabEngine {
  private matlabPath: string = '';
  private running: boolean = false;
  private process: ChildProcess | null = null;
  private figureDir: string;
  private ready: boolean = false;

  constructor(matlabPath: string) {
    this.matlabPath = matlabPath;
    this.figureDir = path.join(os.tmpdir(), 'mlx_figures');
  }

  async start(): Promise<void> {
    if (this.running) return;

    if (!this.matlabPath) {
      this.matlabPath = await this.detectMatlabPath();
    }
    if (!fs.existsSync(this.matlabPath)) {
      throw new Error(`MATLAB executable not found at: ${this.matlabPath}`);
    }

    fs.mkdirSync(this.figureDir, { recursive: true });

    // Start persistent MATLAB process with -nodesktop -nosplash
    const initSentinel = '__MLX_INIT_DONE__';
    return new Promise((resolve, reject) => {
      this.process = spawn(this.matlabPath, ['-nodesktop', '-nosplash'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let startupBuffer = '';
      let resolved = false;
      let sentInit = false;

      const onData = (data: Buffer) => {
        startupBuffer += data.toString();

        // Once we see the first prompt, send initialization commands
        if (startupBuffer.includes('>>') && !sentInit) {
          sentInit = true;
          // Restore path, suppress warnings, configure figures, then print sentinel
          this.process!.stdin!.write(
            `warning('off','all'); try; restoredefaultpath; matlabrc; end; warning('on','all'); set(0,'DefaultFigureVisible','off'); fprintf('${initSentinel}\\n');\n`
          );
        }

        // Wait for init sentinel before marking ready
        if (startupBuffer.includes(initSentinel) && !resolved) {
          resolved = true;
          this.running = true;
          this.ready = true;
          this.process!.stdout!.removeListener('data', onData);
          resolve();
        }
      };

      this.process.stdout!.on('data', onData);

      // Drain stderr during startup so it doesn't block
      this.process.stderr!.on('data', () => {});

      this.process.on('error', (err) => {
        if (!resolved) reject(new Error(`Failed to start MATLAB: ${err.message}`));
      });

      this.process.on('close', () => {
        this.running = false;
        this.ready = false;
        this.process = null;
        if (!resolved) reject(new Error('MATLAB process closed before ready'));
      });

      // Timeout after 120s (path restore can be slow on network volumes)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.process?.kill();
          reject(new Error('MATLAB startup timed out after 120s'));
        }
      }, 120000);
    });
  }

  async execute(code: string): Promise<MatlabResult> {
    if (!this.running || !this.ready || !this.process?.stdin) {
      throw new Error('Engine not started. Call start() first.');
    }

    // Clean figure dir
    this.cleanupDirectory(this.figureDir);
    fs.mkdirSync(this.figureDir, { recursive: true });

    const sentinel = `__MLX_DONE_${Date.now()}__`;

    // Build the command: run user code, capture figures, print sentinel
    const escapedFigDir = this.figureDir.replace(/'/g, "''");
    const wrappedCode = [
      `try`,
      code,
      `catch mlx_err`,
      `fprintf(2, '%s\\n', mlx_err.message);`,
      `end`,
      `mlx_figs = findall(0, 'Type', 'figure');`,
      `for mlx_i = 1:length(mlx_figs)`,
      `  print(mlx_figs(mlx_i), '-dpng', fullfile('${escapedFigDir}', sprintf('fig_%d.png', mlx_i)));`,
      `end`,
      `close all;`,
      `fprintf('${sentinel}\\n');`,
    ].join('\n');

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let done = false;

      const onStdout = (data: Buffer) => {
        stdout += data.toString();
        if (stdout.includes(sentinel)) {
          finish();
        }
      };

      const onStderr = (data: Buffer) => {
        stderr += data.toString();
      };

      const finish = () => {
        if (done) return;
        done = true;
        this.process!.stdout!.removeListener('data', onStdout);
        this.process!.stderr!.removeListener('data', onStderr);

        // Extract output before sentinel, strip prompt chars
        let output = stdout.substring(0, stdout.indexOf(sentinel)).trim();
        // Remove MATLAB >> prompts and echoed commands
        output = output
          .split('\n')
          .filter(line => !line.startsWith('>> ') && line !== '>>')
          .join('\n')
          .trim();

        // Filter startup warnings from stderr
        const filteredStderr = stderr
          .split('\n')
          .filter(line => !line.includes('pathdef.m') &&
                          !line.includes('restoredefaultpath') &&
                          !line.includes('initdesktoputils') &&
                          !line.includes('callConnectorStarted') &&
                          !line.includes('background graphics initialization') &&
                          !line.includes('MATLAB did not appear to successfully set the search path') &&
                          !line.includes('Initializing Java preferences failed') &&
                          !line.includes('potentially serious problem') &&
                          line.trim() !== '')
          .join('\n')
          .trim();

        // Read figures
        const figures: Array<{ data: string }> = [];
        try {
          if (fs.existsSync(this.figureDir)) {
            const files = fs.readdirSync(this.figureDir).sort();
            for (const file of files) {
              if (file.endsWith('.png')) {
                const filePath = path.join(this.figureDir, file);
                figures.push({ data: fs.readFileSync(filePath).toString('base64') });
              }
            }
          }
        } catch {
          // ignore figure read errors
        }

        resolve({
          stdout: output,
          stderr: filteredStderr,
          figures: figures.length > 0 ? figures : undefined,
        });
      };

      this.process!.stdout!.on('data', onStdout);
      this.process!.stderr!.on('data', onStderr);

      // Send code to MATLAB
      this.process!.stdin!.write(wrappedCode + '\n');

      // Timeout per cell: 5 minutes
      setTimeout(() => {
        if (!done) {
          done = true;
          this.process!.stdout!.removeListener('data', onStdout);
          this.process!.stderr!.removeListener('data', onStderr);
          reject(new Error('MATLAB execution timed out after 5 minutes'));
        }
      }, 300000);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      try {
        this.process.stdin?.write('exit;\n');
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (this.process) {
          this.process.kill();
          this.process = null;
        }
      }, 3000);
    }
    this.running = false;
    this.ready = false;
    this.cleanupDirectory(this.figureDir);
  }

  isRunning(): boolean {
    return this.running && this.ready;
  }

  private sendRaw(cmd: string): void {
    try {
      this.process?.stdin?.write(cmd);
    } catch {
      // ignore
    }
  }

  private async detectMatlabPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      const searchDirs = ['/Applications'];
      try {
        const volumes = fs.readdirSync('/Volumes');
        for (const vol of volumes) {
          const volApps = path.join('/Volumes', vol, 'Applications');
          if (fs.existsSync(volApps)) {
            searchDirs.push(volApps);
          }
        }
      } catch {
        // ignore
      }

      for (const appDir of searchDirs) {
        try {
          const apps = fs.readdirSync(appDir);
          const matlabApps = apps
            .filter((app: string) => app.startsWith('MATLAB_') && app.endsWith('.app'))
            .sort()
            .reverse();
          if (matlabApps.length > 0) {
            const matlabPath = path.join(appDir, matlabApps[0], 'bin', 'matlab');
            if (fs.existsSync(matlabPath)) {
              return matlabPath;
            }
          }
        } catch {
          // skip
        }
      }
      throw new Error('MATLAB not found on macOS. Install MATLAB or specify matlabPath.');
    } else if (platform === 'linux') {
      for (const p of ['/usr/local/bin/matlab', '/opt/matlab/bin/matlab', '/usr/bin/matlab']) {
        if (fs.existsSync(p)) return p;
      }
      throw new Error('MATLAB not found on Linux. Install MATLAB or specify matlabPath.');
    } else if (platform === 'win32') {
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const appDir = path.join(programFiles, 'MATLAB');
      if (fs.existsSync(appDir)) {
        const versions = fs.readdirSync(appDir).sort().reverse();
        if (versions.length > 0) {
          const matlabPath = path.join(appDir, versions[0], 'bin', 'matlab.exe');
          if (fs.existsSync(matlabPath)) return matlabPath;
        }
      }
      throw new Error('MATLAB not found on Windows. Install MATLAB or specify matlabPath.');
    }

    throw new Error('Unsupported platform');
  }

  private cleanupDirectory(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        for (const file of fs.readdirSync(dirPath)) {
          const filePath = path.join(dirPath, file);
          if (fs.statSync(filePath).isDirectory()) {
            this.cleanupDirectory(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(dirPath);
      }
    } catch {
      // ignore
    }
  }
}
