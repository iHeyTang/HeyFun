import * as path from 'path';
import { SandboxRunner } from '../../sandbox/base';
import { to } from '../../utils/to';
import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';

interface ToolParameters extends BaseToolParameters {
  operation:
    | 'read'
    | 'write'
    | 'delete'
    | 'create_directory'
    | 'list'
    | 'exists'
    | 'copy'
    | 'move'
    | 'read_binary'
    | 'write_binary'
    | 'get_info'
    | 'pwd';
  path: string;
  content?: string;
  encoding?: string;
  destination?: string;
  binary_data?: string; // base64编码的二进制数据
}

/**
 * 文件系统操作工具 - 支持在沙盒环境中进行常见的文件系统操作
 */
export class FileSystemTool extends AbstractBaseTool<ToolParameters> {
  public name = 'file_system';
  public description =
    'Perform comprehensive file system operations in sandbox environment including read/write text and binary files, create/delete directories, copy/move files, list directory contents, check file existence, and get detailed file information. Supports various encodings and handles large files with warnings.';

  private sandbox: SandboxRunner;

  constructor(sandbox: SandboxRunner) {
    super();
    this.sandbox = sandbox;
  }

  async execute(input: ToolParameters): Promise<ToolResult> {
    try {
      switch (input.operation) {
        case 'read':
          return await this.readFile(input.path, input.encoding);
        case 'write':
          return await this.writeFile(input.path, input.content || '', input.encoding);
        case 'delete':
          return await this.deleteFile(input.path);
        case 'create_directory':
          return await this.createDirectory(input.path);
        case 'list':
          return await this.listDirectory(input.path);
        case 'exists':
          return await this.checkExists(input.path);
        case 'copy':
          return await this.copyFile(input.path, input.destination!);
        case 'move':
          return await this.moveFile(input.path, input.destination!);
        case 'read_binary':
          return await this.readBinaryFile(input.path);
        case 'write_binary':
          return await this.writeBinaryFile(input.path, input.binary_data!);
        case 'get_info':
          return await this.getFileInfo(input.path);
        case 'pwd':
          return await this.getCurrentDirectory();
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown operation '${input.operation}'` }],
            error: 'Unknown operation',
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `File system operation failed: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async readFile(filePath: string, encoding: string = 'utf-8'): Promise<ToolResult> {
    try {
      // 获取文件信息以确定最佳读取方式
      const stats = await this.sandbox.fs.getFileDetails(filePath);

      if (!stats) {
        return { content: [{ type: 'text', text: 'no such file or directory' }] };
      }

      // 对于大文件，提供警告
      if (stats.size > 10 * 1024 * 1024) {
        // 10MB
        return {
          content: [
            {
              type: 'text',
              text: `Warning: File is large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Consider using read_binary for binary files or reading in chunks.`,
            },
          ],
        };
      }

      const buffer = await this.sandbox.fs.downloadFile(filePath);
      const content = buffer.toString(encoding as BufferEncoding);
      return {
        content: [{ type: 'text', text: `File content:\n${content}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error reading file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async writeFile(filePath: string, content: string, encoding: string = 'utf-8'): Promise<ToolResult> {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      try {
        await this.sandbox.fs.createFolder(dir, '755');
      } catch {
        // 目录可能已存在
      }

      // 检查文件是否已存在，如果存在则报错
      const [_e, exsitStats] = await to(this.sandbox.fs.getFileDetails(filePath));
      if (exsitStats) {
        return {
          content: [{ type: 'text', text: `File already exists: ${filePath}` }],
          error: 'File already exists',
        };
      }

      // 使用命令将内容写入指定文件而不是直接调用fs.uploadFileFromBuffe，这个速度很慢
      const result = await this.sandbox.process.executeCommand({
        command: 'sh',
        args: ['-c', `cat > "${filePath}" << 'EOF'\n${content}\nEOF`],
        env: {},
      });
      if (result.exitCode !== 0) {
        return { content: [{ type: 'text', text: `Error writing file: ${result.result}` }] };
      }
      return {
        content: [{ type: 'text', text: `File written successfully: ${filePath} (${content.length} bytes)` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error writing file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async deleteFile(filePath: string): Promise<ToolResult> {
    try {
      await this.sandbox.fs.deleteFile(filePath);
      return {
        content: [{ type: 'text', text: `Successfully deleted: ${filePath}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error deleting file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async createDirectory(dirPath: string): Promise<ToolResult> {
    try {
      await this.sandbox.fs.createFolder(dirPath, '755');
      return {
        content: [{ type: 'text', text: `Directory created successfully: ${dirPath}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error creating directory: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async listDirectory(dirPath: string): Promise<ToolResult> {
    try {
      const items = await this.sandbox.fs.listFiles(dirPath);

      // 转换为统一格式
      const detailedItems = items.map(item => ({
        name: item.name,
        type: item.isDir ? 'directory' : 'file',
        path: path.join(dirPath, item.name),
        size: item.size,
        modified: new Date(item.modTime),
        permissions: item.permissions,
      }));

      // 按类型和名称排序
      const sortedItems = detailedItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      const result = sortedItems
        .map((item, index) => {
          const icon = item.type === 'directory' ? '📁' : '📄';
          const size = item.type === 'file' ? ` (${this.formatFileSize(item.size)})` : '';
          const date = item.modified.toLocaleDateString();
          return `${index + 1}. ${icon} ${item.name}${size} - ${date}`;
        })
        .join('\n');

      const directories = items.filter(i => i.isDir).length;
      const files = items.length - directories;
      const summary = `Total: ${items.length} items (${directories} directories, ${files} files)`;

      return {
        content: [{ type: 'text', text: `Directory contents of ${dirPath}:\n${summary}\n\n${result}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error listing directory: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async checkExists(filePath: string): Promise<ToolResult> {
    try {
      const stats = await this.sandbox.fs.getFileDetails(filePath);
      if (!stats) {
        return { content: [{ type: 'text', text: `Path does not exist: ${filePath}` }] };
      }
      const type = stats.isDir ? 'directory' : 'file';
      return {
        content: [{ type: 'text', text: `Path exists: ${filePath} (${type})` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Path does not exist: ${filePath}` }],
      };
    }
  }

  private async copyFile(sourcePath: string, destinationPath: string): Promise<ToolResult> {
    try {
      const buffer = await this.sandbox.fs.downloadFile(sourcePath);
      await this.sandbox.fs.uploadFileFromBuffer(buffer, destinationPath);
      return {
        content: [{ type: 'text', text: `File copied successfully: ${sourcePath} -> ${destinationPath}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error copying file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async moveFile(sourcePath: string, destinationPath: string): Promise<ToolResult> {
    try {
      await this.sandbox.fs.moveFiles(sourcePath, destinationPath);
      return {
        content: [{ type: 'text', text: `File moved successfully: ${sourcePath} -> ${destinationPath}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error moving file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async readBinaryFile(filePath: string): Promise<ToolResult> {
    try {
      const buffer = await this.sandbox.fs.downloadFile(filePath);
      const base64Data = buffer.toString('base64');
      return {
        content: [{ type: 'text', text: `Binary file content (base64):\n${base64Data}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error reading binary file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async writeBinaryFile(filePath: string, base64Data: string): Promise<ToolResult> {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      try {
        await this.sandbox.fs.createFolder(dir, '755');
      } catch {
        // 目录可能已存在
      }

      const buffer = Buffer.from(base64Data, 'base64');
      await this.sandbox.fs.uploadFileFromBuffer(buffer, filePath);
      return {
        content: [{ type: 'text', text: `Binary file written successfully: ${filePath}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error writing binary file: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async getCurrentDirectory(): Promise<ToolResult> {
    try {
      const currentDir = await this.sandbox.fs.getWorkspacePath();
      return {
        content: [{ type: 'text', text: `Current working directory: ${currentDir}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error getting current directory: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  private async getFileInfo(filePath: string): Promise<ToolResult> {
    try {
      const stats = await this.sandbox.fs.getFileDetails(filePath);
      if (!stats) {
        throw Error('no such file or directory');
      }
      const info = {
        name: stats.name,
        path: filePath,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        type: stats.isDir ? 'directory' : 'file',
        modified: new Date(stats.modTime),
        permissions: stats.permissions,
        owner: stats.owner,
        group: stats.group,
        mode: stats.mode,
        isDirectory: stats.isDir,
        isFile: !stats.isDir,
      };

      return {
        content: [{ type: 'text', text: `File information:\n${JSON.stringify(info, null, 2)}` }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error getting file info: ${errorMessage}` }],
        error: errorMessage,
      };
    }
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'write', 'delete', 'create_directory', 'list', 'exists', 'copy', 'move', 'read_binary', 'write_binary', 'get_info', 'pwd'],
          description: 'The file system operation to perform',
        },
        path: {
          type: 'string',
          description: 'The file or directory path for the operation',
        },
        content: {
          type: 'string',
          description: 'Content to write to file (required for write operation)',
        },
        encoding: {
          type: 'string',
          enum: ['utf-8', 'ascii', 'base64', 'hex'],
          default: 'utf-8',
          description: 'File encoding for read/write operations',
        },
        destination: {
          type: 'string',
          description: 'Destination path for copy/move operations',
        },
        binary_data: {
          type: 'string',
          description: 'Base64 encoded binary data for write_binary operation',
        },
      },
      required: ['operation', 'path'],
    };
  }
}
