import { Daytona, DaytonaConfig, FileInfo, Match, ReplaceResult, Sandbox } from '@daytonaio/sdk';
import {
  BaseSandboxManager,
  SandboxAgentEvent,
  SandboxAgentProxy,
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
import { to } from '@/lib/shared/to';
import { FunMaxConfig } from '@repo/agent';
import { FileUpload } from '@daytonaio/sdk/src/FileSystem';

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

class DaytonaSandboxAgentProxy extends SandboxAgentProxy {
  private link: { url: string; legacyProxyUrl?: string; token: string } | null = null;

  constructor(private sandbox: Sandbox) {
    super();
  }

  async createTask(params: FunMaxConfig): Promise<string> {
    const [error, response] = await to(
      this.request(`/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(params),
      }).then(async res => {
        if (res.status >= 200 && res.status < 300) {
          return (await res.json()) as Promise<{ taskId: string }>;
        }
        throw Error(`Server Error of ${res.url}: Status Code ${res.status}; Response: ${await res.text()}`);
      }),
    );

    if (error || !response.taskId) {
      throw error || new Error('Unkown Error');
    }

    return response.taskId;
  }

  async terminateTask(params: { taskId: string }): Promise<void> {
    await this.request(`/api/tasks/terminate`, {
      method: 'POST',
      body: JSON.stringify({ task_id: params.taskId }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async getTaskEventStream(params: { taskId: string }, onEvent: (event: SandboxAgentEvent) => Promise<void>): Promise<void> {
    const streamResponse = await this.request(`/api/tasks/event?taskId=${params.taskId}`, { method: 'GET', keepalive: true }, 300000);
    const reader = streamResponse.body?.getReader();
    if (!reader) throw new Error('Failed to get response stream');

    const decoder = new TextDecoder();

    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        const lines = buffer.split('\n');
        // Keep the last line (might be incomplete) if not the final read
        buffer = done ? '' : lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

          try {
            const parsed = JSON.parse(line.slice(6)) as {
              id: string;
              name: string;
              step: number;
              timestamp: string;
              content: any;
            };
            await onEvent(parsed);
          } catch (error) {
            console.error('Failed to process message:', error);
          }
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async getAgentLink() {
    if (this.link) {
      return this.link;
    }
    const previewLink = await this.sandbox.getPreviewLink(3000);
    this.link = previewLink;
    return previewLink;
  }

  private async request(url: string, options: RequestInit, timeout = 30000) {
    const link = await this.getAgentLink();
    return fetch(`${link.legacyProxyUrl || link.url}${url}`, {
      ...options,
      headers: { ...options.headers, 'x-daytona-preview-token': link.token },
      signal: AbortSignal.timeout(timeout),
    });
  }
}

class DaytonaSandboxFileSystem extends SandboxFileSystem {
  constructor(private sandbox: Sandbox) {
    super();
  }

  async createFolder(path: string, mode: string): Promise<void> {
    return await this.sandbox.fs.createFolder(path, mode);
  }

  async deleteFile(path: string): Promise<void> {
    return await this.sandbox.fs.deleteFile(path);
  }

  async downloadFile(path: string, timeout?: number): Promise<Buffer> {
    return await this.sandbox.fs.downloadFile(path, timeout);
  }

  async findFiles(path: string, pattern: string): Promise<SandboxFileMatch[]> {
    return await this.sandbox.fs.findFiles(path, pattern);
  }

  async getFileDetails(path: string): Promise<SandboxFileInfo> {
    return await this.sandbox.fs.getFileDetails(path);
  }

  async listFiles(path: string): Promise<SandboxFileInfo[]> {
    const file = await this.sandbox.fs.listFiles(path);
    return file;
  }

  async moveFiles(source: string, destination: string): Promise<void> {
    return await this.sandbox.fs.moveFiles(source, destination);
  }

  async replaceInFiles(files: string[], pattern: string, newValue: string): Promise<SandboxFileReplaceResult[]> {
    return await this.sandbox.fs.replaceInFiles(files, pattern, newValue);
  }

  async searchFiles(path: string, pattern: string): Promise<SandboxFileSearchFilesResponse> {
    return await this.sandbox.fs.searchFiles(path, pattern);
  }

  async setFilePermissions(path: string, permissions: SandboxFilePermissionsParams): Promise<void> {
    return await this.sandbox.fs.setFilePermissions(path, permissions);
  }

  async uploadFileFromBuffer(file: Buffer, remotePath: string, timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFile(file, remotePath, timeout);
  }

  async uploadFileFromLocal(localPath: string, remotePath: string, timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFile(localPath, remotePath, timeout);
  }

  async uploadFiles(files: SandboxFileUpload[], timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFiles(files, timeout);
  }
}

export class DaytonaSandboxRunner extends SandboxRunner {
  public readonly process: SandboxProcess;
  public readonly agent: SandboxAgentProxy;
  public readonly fs: SandboxFileSystem;
  constructor(
    public readonly id: string,
    private sandbox: Sandbox,
  ) {
    super();
    this.process = new DaytonaSandboxProcess(this.sandbox);
    this.agent = new DaytonaSandboxAgentProxy(this.sandbox);
    this.fs = new DaytonaSandboxFileSystem(this.sandbox);
  }
}

export class DaytonaSandboxManager extends BaseSandboxManager {
  private daytona: Daytona;

  constructor(config?: DaytonaConfig) {
    super();
    this.daytona = new Daytona(config);
  }

  async list(): Promise<SandboxRunner[]> {
    const sandboxes = await this.daytona.list();
    return sandboxes.map(sandbox => {
      const id = `daytona-${sandbox.id}`;
      return new DaytonaSandboxRunner(id, sandbox);
    });
  }

  async findOneById(id: string): Promise<SandboxRunner> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    return new DaytonaSandboxRunner(id, sandbox);
  }

  async create(params: { user: string }): Promise<SandboxRunner> {
    const sandbox = await this.daytona.create({
      snapshot: 'iheytang/heyfun-agent:dev-12',
      user: 'daytona',
      labels: { name: 'Default Sandbox' },
    });

    const id = `daytona-${params.user}`;
    const runner = new DaytonaSandboxRunner(id, sandbox);
    await sandbox.process.createSession('heyfun-agent');
    await sandbox.process.executeSessionCommand('heyfun-agent', { command: 'node /heyfun/app/apps/agent/server.js', runAsync: true });
    return runner;
  }

  async delete(id: string, timeout?: number): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.delete(sandbox, timeout);
  }

  async start(id: string): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.start(sandbox);
  }

  async stop(id: string): Promise<void> {
    const innerId = id.replace('daytona-', '');
    const sandbox = await this.daytona.findOne({ id: innerId });
    await this.daytona.stop(sandbox);
  }
}
