import {
  BaseSandboxManager,
  SandboxFileInfo,
  SandboxFileMatch,
  SandboxFilePermissionsParams,
  SandboxFileReplaceResult,
  SandboxFileSearchFilesResponse,
  SandboxFileSystem,
  SandboxFileUpload,
  SandboxProcess,
  SandboxRunner,
  SandboxWebPortal,
  SandboxWebPortalSchema,
} from './base';
import { spawn, ChildProcess, exec } from 'child_process';
import path, { join } from 'path';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

interface LocalSandboxConfig {
  agentPath?: string;
  port?: number;
}

class LocalSandboxProcess extends SandboxProcess {
  private longTermProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
  }

  async executeCommand(params: { command: string; args: string[]; env: Record<string, string> }): Promise<string> {
    const cmd = `${params.command} ${params.args.join(' ')}`;
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env, ...params.env },
        cwd: process.cwd(),
      });

      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
      }

      return stdout;
    } catch (error) {
      throw new Error(`Failed to execute command: ${cmd}. Error: ${error}`);
    }
  }

  async executeLongTermCommand(params: { id: string; command: string; args: string[]; env: Record<string, string> }): Promise<void> {
    const cmd = `${params.command} ${params.args.join(' ')}`;

    // 检查是否已经有相同 ID 的进程在运行
    if (this.longTermProcesses.has(params.id)) {
      const existingProcess = this.longTermProcesses.get(params.id);
      if (existingProcess && !existingProcess.killed) {
        console.log(`Long-term command ${params.id} is already running`);
        return;
      } else {
        // 清理已退出的进程
        this.longTermProcesses.delete(params.id);
      }
    }

    try {
      const childProcess = spawn(params.command, params.args, {
        env: { ...process.env, ...params.env },
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      // 存储进程引用
      this.longTermProcesses.set(params.id, childProcess);

      // 监听输出
      childProcess.stdout?.on('data', data => {
        console.log(`[LongTerm-${params.id}] ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', data => {
        console.error(`[LongTerm-${params.id}-Error] ${data.toString().trim()}`);
      });

      // 监听进程退出
      childProcess.on('exit', code => {
        console.log(`Long-term command ${params.id} exited with code ${code}`);
        this.longTermProcesses.delete(params.id);
      });

      // 监听进程错误
      childProcess.on('error', error => {
        console.error(`Long-term command ${params.id} failed:`, error);
        this.longTermProcesses.delete(params.id);
      });

      console.log(`Started long-term command ${params.id}: ${cmd}`);
    } catch (error) {
      throw new Error(`Failed to execute long-term command: ${cmd}. Error: ${error}`);
    }
  }

  // 添加一个方法来停止长期运行的命令
  async stopLongTermCommand(id: string): Promise<void> {
    const process = this.longTermProcesses.get(id);
    if (process && !process.killed) {
      console.log(`Stopping long-term command ${id}...`);
      process.kill('SIGTERM');

      // 等待进程优雅退出
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          resolve();
        }, 5000);

        process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.longTermProcesses.delete(id);
      console.log(`Long-term command ${id} stopped`);
    } else {
      console.log(`Long-term command ${id} is not running`);
    }
  }

  // 添加一个方法来列出所有长期运行的命令
  getLongTermCommands(): string[] {
    return Array.from(this.longTermProcesses.keys());
  }
}

class LocalSandboxFileSystem extends SandboxFileSystem {
  constructor() {
    super();
  }

  async createFolder(path: string, mode: string): Promise<void> {
    const absolutePath = await this.resolvePath(path);
    await fs.mkdir(absolutePath, { recursive: true });
    await fs.chmod(absolutePath, parseInt(mode, 8));
  }

  async deleteFile(path: string): Promise<void> {
    const absolutePath = await this.resolvePath(path);
    await fs.rm(absolutePath, { recursive: true });
  }

  async downloadFile(path: string, timeout?: number): Promise<Buffer> {
    const absolutePath = await this.resolvePath(path);
    return await fs.readFile(absolutePath);
  }

  async findFiles(path: string, pattern: string): Promise<SandboxFileMatch[]> {
    const matches: SandboxFileMatch[] = [];
    const absolutePath = await this.resolvePath(path);
    const files = await fs.readdir(absolutePath);
    const promises = files.map(async file => {
      const content = await fs.readFile(join(absolutePath, file));
      const lines = content.toString().split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes(pattern)) {
          matches.push({ file, line: i + 1, content: line });
        }
      }
    });
    await Promise.all(promises);
    return matches;
  }

  async getFileDetails(p: string): Promise<SandboxFileInfo> {
    const absolutePath = await this.resolvePath(p);
    const stats = await fs.stat(absolutePath);
    return {
      name: path.basename(absolutePath),
      size: stats.size,
      owner: stats.uid.toString(),
      group: stats.gid.toString(),
      isDir: stats.isDirectory(),
      modTime: stats.mtime.toISOString(),
      mode: stats.mode.toString(8),
      permissions: stats.mode.toString(8),
    };
  }

  async listFiles(path: string): Promise<SandboxFileInfo[]> {
    const absolutePath = await this.resolvePath(path);
    const files = await fs.readdir(absolutePath);
    return Promise.all(
      files.map(async file => {
        const stats = await fs.stat(join(absolutePath, file));
        return {
          name: file,
          size: stats.size,
          owner: stats.uid.toString(),
          group: stats.gid.toString(),
          isDir: stats.isDirectory(),
          modTime: stats.mtime.toISOString(),
          mode: stats.mode.toString(8),
          permissions: stats.mode.toString(8),
        };
      }),
    );
  }

  async moveFiles(source: string, destination: string): Promise<void> {
    const absoluteSource = await this.resolvePath(source);
    const absoluteDestination = await this.resolvePath(destination);
    await fs.rename(absoluteSource, absoluteDestination);
  }

  async replaceInFiles(files: string[], pattern: string, newValue: string): Promise<SandboxFileReplaceResult[]> {
    const absoluteFiles = files.map(file => join(process.cwd(), 'workspace', file));
    const promises = absoluteFiles.map(async file => {
      const content = await fs.readFile(file, 'utf8');
      const newContent = content.replace(pattern, newValue);
      await fs.writeFile(file, newContent);
    });
    await Promise.all(promises);
    return files.map(file => ({ file, success: true }));
  }

  async searchFiles(path: string, pattern: string): Promise<SandboxFileSearchFilesResponse> {
    const absolutePath = await this.resolvePath(path);
    const files = await fs.readdir(absolutePath);
    return {
      files: files.filter(file => file.includes(pattern)),
    };
  }

  async setFilePermissions(path: string, permissions: SandboxFilePermissionsParams): Promise<void> {
    const absolutePath = await this.resolvePath(path);
    await fs.chmod(absolutePath, parseInt(permissions.mode!, 8));
  }

  async uploadFileFromBuffer(file: Buffer, remotePath: string, timeout?: number): Promise<void> {
    const absolutePath = await this.resolvePath(remotePath);
    await fs.writeFile(absolutePath, file);
  }

  async uploadFileFromLocal(localPath: string, remotePath: string, timeout?: number): Promise<void> {
    const absolutePath = await this.resolvePath(remotePath);
    await fs.copyFile(localPath, absolutePath);
  }

  async uploadFiles(files: SandboxFileUpload[], timeout?: number): Promise<void> {
    const promises = files.map(async file => {
      const absolutePath = await this.resolvePath(file.destination);
      await fs.writeFile(absolutePath, file.source);
    });
    await Promise.all(promises);
  }

  async getWorkspacePath(): Promise<string> {
    return join(process.cwd(), 'workspace');
  }

  async resolvePath(p: string): Promise<string> {
    const workspacePath = await this.getWorkspacePath();
    return path.resolve(workspacePath, p);
  }
}

class LocalSandboxWebPortal extends SandboxWebPortal {
  constructor() {
    super();
  }

  async getMcpUniPortal(): Promise<SandboxWebPortalSchema> {
    return {
      url: `http://localhost:7200/stream`,
      headers: {},
    };
  }
}

export class LocalSandboxRunner extends SandboxRunner {
  public readonly process: SandboxProcess;
  public readonly fs: SandboxFileSystem;
  public readonly portal: SandboxWebPortal;
  constructor(public readonly id: string) {
    super();
    this.process = new LocalSandboxProcess();
    this.fs = new LocalSandboxFileSystem();
    this.portal = new LocalSandboxWebPortal();
  }
}

export class LocalSandboxManager extends BaseSandboxManager {
  private config: LocalSandboxConfig;
  private processes: Map<string, ChildProcess> = new Map();

  constructor(config: LocalSandboxConfig = {}) {
    super();
    this.config = {
      agentPath: join(process.cwd(), '..', 'agent'),
      port: 7200,
      ...config,
    };
  }

  async list(): Promise<SandboxRunner[]> {
    // 本地模式下，我们只返回一个固定的 sandbox
    return [new LocalSandboxRunner('local-agent')];
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    return new LocalSandboxRunner(id);
  }

  async create(id: string): Promise<SandboxRunner> {
    // 本地模式下，创建就是启动进程
    const runner = new LocalSandboxRunner('local-agent');
    await this.start('local-agent');
    return runner;
  }

  async getOrCreateOneById(id: string): Promise<SandboxRunner> {
    return this.create(id);
  }

  async delete(id: string, timeout?: number): Promise<void> {
    await this.stop(id);
  }

  async start(id: string): Promise<void> {
    // do nothing
  }

  async stop(id: string): Promise<void> {
    // do nothing
  }
}
