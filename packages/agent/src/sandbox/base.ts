/**
 * 沙盒进程，它负责执行命令
 */
export abstract class SandboxProcess {
  abstract executeCommand(params: { command: string; args: string[]; env: Record<string, string> }): Promise<string>;
  abstract executeLongTermCommand(params: { id: string; command: string; args: string[]; env: Record<string, string> }): Promise<void>;
}

export interface SandboxFileInfo {
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  name: string;
  /**
   *
   * @type {boolean}
   * @memberof FileInfo
   */
  isDir: boolean;
  /**
   *
   * @type {number}
   * @memberof FileInfo
   */
  size: number;
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  modTime: string;
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  mode: string;
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  permissions: string;
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  owner: string;
  /**
   *
   * @type {string}
   * @memberof FileInfo
   */
  group: string;
}

export interface SandboxFileMatch {
  /**
   *
   * @type {string}
   * @memberof SandboxFileMatch
   */
  file: string;
  /**
   *
   * @type {number}
   * @memberof SandboxFileMatch
   */
  line: number;
  /**
   *
   * @type {string}
   * @memberof SandboxFileMatch
   */
  content: string;
}

export interface SandboxFileReplaceResult {
  /**
   *
   * @type {string}
   * @memberof SandboxFileReplaceResult
   */
  file?: string;
  /**
   *
   * @type {boolean}
   * @memberof SandboxFileReplaceResult
   */
  success?: boolean;
  /**
   *
   * @type {string}
   * @memberof SandboxFileReplaceResult
   */
  error?: string;
}
export interface SandboxFileSearchFilesResponse {
  /**
   *
   * @type {Array<string>}
   * @memberof SandboxFileSearchFilesResponse
   */
  files: Array<string>;
}

export interface SandboxFilePermissionsParams {
  /** Group owner of the file */
  group?: string;
  /** File mode/permissions in octal format (e.g. "644") */
  mode?: string;
  /** User owner of the file */
  owner?: string;
}

export interface SandboxFileUpload {
  source: string | Buffer;
  destination: string;
}

export abstract class SandboxFileSystem {
  abstract createFolder(path: string, mode: string): Promise<void>;
  abstract deleteFile(path: string): Promise<void>;
  abstract downloadFile(path: string, timeout?: number): Promise<Buffer>;
  abstract findFiles(path: string, pattern: string): Promise<SandboxFileMatch[]>;
  abstract getFileDetails(path: string): Promise<SandboxFileInfo>;
  abstract listFiles(path: string): Promise<SandboxFileInfo[]>;
  abstract moveFiles(source: string, destination: string): Promise<void>;
  abstract replaceInFiles(files: string[], pattern: string, newValue: string): Promise<SandboxFileReplaceResult[]>;
  abstract searchFiles(path: string, pattern: string): Promise<SandboxFileSearchFilesResponse>;
  abstract setFilePermissions(path: string, permissions: SandboxFilePermissionsParams): Promise<void>;
  abstract uploadFileFromBuffer(file: Buffer, remotePath: string, timeout?: number): Promise<void>;
  abstract uploadFileFromLocal(localPath: string, remotePath: string, timeout?: number): Promise<void>;
  abstract uploadFiles(files: SandboxFileUpload[], timeout?: number): Promise<void>;
  abstract getWorkspacePath(): Promise<string>;
  abstract resolvePath(path: string): Promise<string>;
}

export interface SandboxWebPortalSchema {
  url: string;
  headers: Record<string, string>;
}

export abstract class SandboxWebPortal {
  abstract getMcpUniPortal(): Promise<SandboxWebPortalSchema>;
}

/**
 * 沙盒运行器，它负责连接到 sandbox 的 runner 使得当前进程可以和 sandbox 的 runner 进行通信
 */
export abstract class SandboxRunner {
  abstract readonly id: string;
  abstract process: SandboxProcess;
  abstract fs: SandboxFileSystem;
  abstract portal: SandboxWebPortal;
}

export abstract class BaseSandboxManager {
  /**
   * 列出所有沙盒
   */
  abstract list(): Promise<SandboxRunner[]>;

  /**
   * 根据 id 获取沙盒
   */
  abstract findOneById(id: string): Promise<SandboxRunner>;

  /**
   * 创建沙盒
   */
  abstract create(id: string): Promise<SandboxRunner>;

  /**
   * 根据 key 获取沙盒，若沙盒不存在，则创建一个，保证每个key的沙盒唯一
   */
  abstract getOrCreateOneById(id: string): Promise<SandboxRunner>;

  /**
   * 删除沙盒
   */
  abstract delete(id: string, timeout?: number): Promise<void>;

  abstract start(id: string): Promise<void>;

  abstract stop(id: string): Promise<void>;
}
