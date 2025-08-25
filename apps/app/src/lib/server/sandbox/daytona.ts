import { Daytona, DaytonaConfig, Sandbox, SandboxState } from '@daytonaio/sdk';
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
} from './base';
import path, { join } from 'path';

class DaytonaSandboxProcess extends SandboxProcess {
  constructor(private sandbox: Sandbox) {
    super();
  }

  async executeCommand(params: { command: string; args: string[]; env: Record<string, string> }): Promise<string> {
    const cmd = `${params.command} ${params.args.join(' ')}`;
    const res = await this.sandbox.process.executeCommand(cmd, undefined, params.env);
    return res.result;
  }

  async executeLongTermCommand(params: { id: string; command: string; args: string[]; env: Record<string, string> }): Promise<void> {
    const cmd = `${params.command} ${params.args.join(' ')}`;
    await this.sandbox.process.createSession(params.id);
    await this.sandbox.process.executeSessionCommand(params.id, { command: cmd, runAsync: true });
  }
}

class DaytonaSandboxFileSystem extends SandboxFileSystem {
  constructor(private sandbox: Sandbox) {
    super();
  }

  async createFolder(p: string, mode: string): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.createFolder(path.resolve(workspacePath, p), mode);
  }

  async deleteFile(p: string): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.deleteFile(path.resolve(workspacePath, p));
  }

  async downloadFile(p: string, timeout?: number): Promise<Buffer> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.downloadFile(path.resolve(workspacePath, p), timeout);
  }

  async findFiles(p: string, pattern: string): Promise<SandboxFileMatch[]> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.findFiles(path.resolve(workspacePath, p), pattern);
  }

  async getFileDetails(p: string): Promise<SandboxFileInfo> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.getFileDetails(path.resolve(workspacePath, p));
  }

  async listFiles(p: string): Promise<SandboxFileInfo[]> {
    const workspacePath = await this.getWorkspacePath();
    const file = await this.sandbox.fs.listFiles(path.resolve(workspacePath, p));
    return file;
  }

  async moveFiles(source: string, destination: string): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.moveFiles(path.resolve(workspacePath, source), path.resolve(workspacePath, destination));
  }

  async replaceInFiles(files: string[], pattern: string, newValue: string): Promise<SandboxFileReplaceResult[]> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.replaceInFiles(
      files.map(file => path.resolve(workspacePath, file)),
      pattern,
      newValue,
    );
  }

  async searchFiles(p: string, pattern: string): Promise<SandboxFileSearchFilesResponse> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.searchFiles(path.resolve(workspacePath, p), pattern);
  }

  async setFilePermissions(p: string, permissions: SandboxFilePermissionsParams): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.setFilePermissions(path.resolve(workspacePath, p), permissions);
  }

  async uploadFileFromBuffer(file: Buffer, remotePath: string, timeout?: number): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.uploadFile(file, path.resolve(workspacePath, remotePath), timeout);
  }

  async uploadFileFromLocal(localPath: string, remotePath: string, timeout?: number): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.uploadFile(localPath, path.resolve(workspacePath, remotePath), timeout);
  }

  async uploadFiles(files: SandboxFileUpload[], timeout?: number): Promise<void> {
    const workspacePath = await this.getWorkspacePath();
    return await this.sandbox.fs.uploadFiles(
      files.map(file => ({ ...file, destination: path.resolve(workspacePath, file.destination) })),
      timeout,
    );
  }

  async getWorkspacePath(): Promise<string> {
    return join(process.cwd(), 'workspace');
  }

  async resolvePath(p: string): Promise<string> {
    const workspacePath = await this.getWorkspacePath();
    return path.resolve(workspacePath, p);
  }
}

export class DaytonaSandboxRunner extends SandboxRunner {
  public readonly process: SandboxProcess;
  public readonly fs: SandboxFileSystem;
  constructor(
    public readonly id: string,
    private sandbox: Sandbox,
  ) {
    super();
    this.process = new DaytonaSandboxProcess(this.sandbox);
    this.fs = new DaytonaSandboxFileSystem(this.sandbox);
  }
}

type DaytonaSandboxLabels = {
  id: string;
};

export class DaytonaSandboxManager extends BaseSandboxManager {
  private daytona: Daytona;

  constructor(config?: DaytonaConfig) {
    super();
    this.daytona = new Daytona(config);
  }

  async list(): Promise<SandboxRunner[]> {
    const sandboxes = await this.daytona.list();
    return sandboxes
      .filter(sandbox => (sandbox.labels as DaytonaSandboxLabels).id)
      .map(sandbox => {
        return new DaytonaSandboxRunner((sandbox.labels as DaytonaSandboxLabels).id!, sandbox);
      });
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    const sandbox = await this.daytona.findOne({ labels: { id } });
    return new DaytonaSandboxRunner((sandbox.labels as DaytonaSandboxLabels).id!, sandbox);
  }

  async create(id: string): Promise<SandboxRunner> {
    const volume = await this.daytona.volume.get(id, true);
    const sandbox = await this.daytona.create({
      snapshot: process.env.DAYTONA_SANDBOX_SNAPSHOT,
      user: 'daytona',
      labels: { id },
      volumes: [{ volumeId: volume.id, mountPath: '/heyfun/workspace' }],
    });

    const runner = new DaytonaSandboxRunner(id, sandbox);
    await sandbox.fs.createFolder('/heyfun/workspace', '755');
    return runner;
  }

  async getOrCreateOneById(id: string): Promise<SandboxRunner> {
    try {
      const sandbox = await this.daytona.findOne({ labels: { id } });
      if (sandbox.state !== SandboxState.STARTED) {
        await this.daytona.start(sandbox);
      }
      return new DaytonaSandboxRunner(id, sandbox);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message.includes('No sandbox found with labels')) {
        return this.create(id);
      }
      throw error;
    }
  }

  async delete(id: string, timeout?: number): Promise<void> {
    const sandbox = await this.daytona.findOne({ labels: { id } });
    await this.daytona.delete(sandbox, timeout);
  }

  async start(id: string): Promise<void> {
    const sandbox = await this.daytona.findOne({ labels: { id } });
    await this.daytona.start(sandbox);
  }

  async stop(id: string): Promise<void> {
    const sandbox = await this.daytona.findOne({ labels: { id } });
    await this.daytona.stop(sandbox);
  }
}
