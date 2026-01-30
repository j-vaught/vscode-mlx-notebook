import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MatlabEngine, MatlabResult } from './matlabEngine';

export class CliBackend implements MatlabEngine {
  private matlabPath: string = '';
  private running: boolean = false;
  private workspacePath: string;

  constructor(matlabPath: string) {
    this.matlabPath = matlabPath;
    this.workspacePath = path.join(os.tmpdir(), 'mlx_ws.mat');
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Auto-detect MATLAB path if not provided
    if (!this.matlabPath) {
      this.matlabPath = await this.detectMatlabPath();
    }

    // Verify MATLAB exists
    if (!fs.existsSync(this.matlabPath)) {
      throw new Error(`MATLAB executable not found at: ${this.matlabPath}`);
    }

    this.running = true;
  }

  async execute(code: string): Promise<MatlabResult> {
    if (!this.running) {
      throw new Error('Engine not started. Call start() first.');
    }

    // Create temp directory for this execution
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlx_exec_'));
    const scriptPath = path.join(tmpDir, 'exec_script.m');
    const figureDir = path.join(tmpDir, 'figures');
    fs.mkdirSync(figureDir, { recursive: true });

    try {
      // Build wrapper script
      const wrapper = `
% Load workspace if exists
if isfile('${this.workspacePath.replace(/\\/g, '\\\\')}')
    load('${this.workspacePath.replace(/\\/g, '\\\\')}');
end

% Disable figure display
set(0, 'DefaultFigureVisible', 'off');

% User code
${code}

% Capture figures
figs = findall(0, 'Type', 'figure');
for i = 1:length(figs)
    figPath = fullfile('${figureDir.replace(/\\/g, '\\\\')}', sprintf('fig_%d.png', i));
    print(figs(i), '-dpng', figPath);
end
close all;

% Save workspace
save('${this.workspacePath.replace(/\\/g, '\\\\')}');
`;

      fs.writeFileSync(scriptPath, wrapper, 'utf8');

      // Execute MATLAB script
      const result = await this.spawnMatlab(scriptPath);

      // Read figure files
      const figures: Array<{ data: string }> = [];
      if (fs.existsSync(figureDir)) {
        const files = fs.readdirSync(figureDir).sort();
        for (const file of files) {
          if (file.endsWith('.png')) {
            const filePath = path.join(figureDir, file);
            const data = fs.readFileSync(filePath);
            figures.push({ data: data.toString('base64') });
          }
        }
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        figures: figures.length > 0 ? figures : undefined,
      };
    } finally {
      // Cleanup temp directory
      this.cleanupDirectory(tmpDir);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    // Cleanup temp workspace
    if (fs.existsSync(this.workspacePath)) {
      try {
        fs.unlinkSync(this.workspacePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async detectMatlabPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS: check /Applications for MATLAB
      const appDir = '/Applications';
      if (fs.existsSync(appDir)) {
        const apps = fs.readdirSync(appDir);
        const matlabApps = apps
          .filter((app) => app.startsWith('MATLAB_') && app.endsWith('.app'))
          .sort()
          .reverse();

        if (matlabApps.length > 0) {
          const latestApp = matlabApps[0];
          const matlabPath = path.join(appDir, latestApp, 'bin', 'matlab');
          if (fs.existsSync(matlabPath)) {
            return matlabPath;
          }
        }
      }
      throw new Error('MATLAB not found on macOS. Install MATLAB or specify matlabPath.');
    } else if (platform === 'linux') {
      // Try common Linux paths
      const commonPaths = ['/usr/local/bin/matlab', '/opt/matlab/bin/matlab', '/usr/bin/matlab'];
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      throw new Error('MATLAB not found on Linux. Install MATLAB or specify matlabPath.');
    } else if (platform === 'win32') {
      // Windows: check Program Files
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const appDir = path.join(programFiles, 'MATLAB');
      if (fs.existsSync(appDir)) {
        const versions = fs.readdirSync(appDir).sort().reverse();
        if (versions.length > 0) {
          const matlabPath = path.join(appDir, versions[0], 'bin', 'matlab.exe');
          if (fs.existsSync(matlabPath)) {
            return matlabPath;
          }
        }
      }
      throw new Error('MATLAB not found on Windows. Install MATLAB or specify matlabPath.');
    }

    throw new Error('Unsupported platform');
  }

  private spawnMatlab(scriptPath: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.matlabPath, ['-batch', `run('${scriptPath}')`], {
        timeout: 300000, // 5 minute timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn MATLAB: ${error.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          // MATLAB often returns non-zero even on success with -batch
          // Only treat as error if there's stderr output
          if (stderr.includes('Error') || stderr.includes('error')) {
            reject(new Error(`MATLAB exited with code ${code}: ${stderr}`));
          } else {
            resolve({ stdout, stderr });
          }
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  private cleanupDirectory(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            this.cleanupDirectory(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(dirPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
