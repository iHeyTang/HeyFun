import { Daytona, DaytonaConfig, Sandbox, SandboxState } from '@daytonaio/sdk';
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
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000; // 1 second
  private readonly MAX_DELAY = 10000; // 10 seconds

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
    let lastError: any;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
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
          // If we reach here, the stream completed successfully
          return;
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        lastError = error;
        console.error(`[Daytona] EventStream attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed:`, error);

        if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
          // Reset link on network errors to force re-establishment
          if (error instanceof TypeError && error.message.includes('fetch')) {
            this.link = null;
            console.log(`[Daytona] Network error in event stream, resetting link for retry`);
          }

          const delay = this.calculateRetryDelay(attempt);
          console.log(`[Daytona] Retrying event stream in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(this.BASE_DELAY * Math.pow(2, attempt), this.MAX_DELAY);
    // Add some jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network errors
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
        return true;
      }
    }
    if (error?.status >= 500 && error?.status < 600) {
      return true; // 5xx server errors
    }
    if (error?.status === 429) {
      return true; // Rate limiting
    }
    return false;
  }

  private async getAgentLink() {
    if (this.link) {
      return this.link;
    }

    let lastError: any;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (this.sandbox.state !== SandboxState.STARTED) {
          await this.sandbox.start();
          await this.sandbox.waitUntilStarted();
        }
        const previewLink = await this.sandbox.getPreviewLink(3000);
        this.link = previewLink;
        return previewLink;
      } catch (error) {
        lastError = error;
        console.error(`[Daytona] getAgentLink attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed:`, error);

        if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`[Daytona] Retrying getAgentLink in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  private async request(url: string, options: RequestInit, timeout = 30000) {
    let lastError: any;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const link = await this.getAgentLink();
        console.log(`[Daytona] url: ${link.legacyProxyUrl || link.url}${url} (attempt ${attempt + 1}/${this.MAX_RETRIES + 1})`);
        console.log(`[Daytona] x-daytona-preview-token: ${link.token}`);

        const response = await fetch(`${link.legacyProxyUrl || link.url}${url}`, {
          ...options,
          headers: { ...options.headers, 'x-daytona-preview-token': link.token },
          signal: AbortSignal.timeout(timeout),
        });

        // Check if response indicates a retryable error
        if (!response.ok && this.isRetryableError({ status: response.status })) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        console.error(`[Daytona] Request attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed:`, error);

        if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
          // Reset link on network errors to force re-establishment
          if (error instanceof TypeError && error.message.includes('fetch')) {
            this.link = null;
            console.log(`[Daytona] Network error detected, resetting link for retry`);
          }

          const delay = this.calculateRetryDelay(attempt);
          console.log(`[Daytona] Retrying request in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }
}

class DaytonaSandboxFileSystem extends SandboxFileSystem {
  constructor(private sandbox: Sandbox) {
    super();
  }

  async createFolder(path: string, mode: string): Promise<void> {
    return await this.sandbox.fs.createFolder(this.buildRemotePath(path), mode);
  }

  async deleteFile(path: string): Promise<void> {
    return await this.sandbox.fs.deleteFile(this.buildRemotePath(path));
  }

  async downloadFile(path: string, timeout?: number): Promise<Buffer> {
    return await this.sandbox.fs.downloadFile(this.buildRemotePath(path), timeout);
  }

  async findFiles(path: string, pattern: string): Promise<SandboxFileMatch[]> {
    return await this.sandbox.fs.findFiles(this.buildRemotePath(path), pattern);
  }

  async getFileDetails(path: string): Promise<SandboxFileInfo> {
    return await this.sandbox.fs.getFileDetails(this.buildRemotePath(path));
  }

  async listFiles(path: string): Promise<SandboxFileInfo[]> {
    const file = await this.sandbox.fs.listFiles(this.buildRemotePath(path));
    return file;
  }

  async moveFiles(source: string, destination: string): Promise<void> {
    return await this.sandbox.fs.moveFiles(this.buildRemotePath(source), this.buildRemotePath(destination));
  }

  async replaceInFiles(files: string[], pattern: string, newValue: string): Promise<SandboxFileReplaceResult[]> {
    return await this.sandbox.fs.replaceInFiles(
      files.map(file => this.buildRemotePath(file)),
      pattern,
      newValue,
    );
  }

  async searchFiles(path: string, pattern: string): Promise<SandboxFileSearchFilesResponse> {
    return await this.sandbox.fs.searchFiles(this.buildRemotePath(path), pattern);
  }

  async setFilePermissions(path: string, permissions: SandboxFilePermissionsParams): Promise<void> {
    return await this.sandbox.fs.setFilePermissions(this.buildRemotePath(path), permissions);
  }

  async uploadFileFromBuffer(file: Buffer, remotePath: string, timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFile(file, this.buildRemotePath(remotePath), timeout);
  }

  async uploadFileFromLocal(localPath: string, remotePath: string, timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFile(localPath, this.buildRemotePath(remotePath), timeout);
  }

  async uploadFiles(files: SandboxFileUpload[], timeout?: number): Promise<void> {
    return await this.sandbox.fs.uploadFiles(
      files.map(file => ({ ...file, destination: this.buildRemotePath(file.destination) })),
      timeout,
    );
  }

  private buildRemotePath(path: string): string {
    return `/heyfun/workspace/${path}`;
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
