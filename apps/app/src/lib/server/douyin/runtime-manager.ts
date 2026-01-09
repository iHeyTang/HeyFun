/**
 * 抖音工具 Runtime Manager
 * 在 sandbox 中执行 Python 脚本来解析和下载抖音视频
 */

import { getSandboxRuntimeManager, type SandboxRuntimeManager } from '@/lib/server/sandbox';
import type { SandboxHandle } from '@/lib/server/sandbox/handle';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';
import { nanoid } from 'nanoid';
// 直接导入 Python 脚本，webpack 会将其作为字符串内联
import parseVideoScript from './scripts/parse-video.py';
import downloadVideoScript from './scripts/download-video.py';

export interface DouyinVideoInfo {
  videoId: string;
  title: string;
  author: {
    name: string;
    id: string;
    avatar?: string;
  };
  videoUrl: string;
  coverUrl?: string;
  duration?: number;
  description?: string;
  stats: {
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    viewCount?: number;
  };
  publishTime?: string;
}

export interface DouyinActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 抖音 Runtime Manager
 */
export class DouyinRuntimeManager {
  /**
   * 从 Python 脚本输出中解析 JSON
   */
  private parseScriptOutput(stdout: string): any {
    try {
      // 尝试直接解析整个输出
      return JSON.parse(stdout.trim());
    } catch (e) {
      // 如果失败，尝试从最后一行解析（JSON 应该在最后一行）
      const lines = stdout.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]?.trim();
        if (line && (line.startsWith('{') || line.startsWith('['))) {
          try {
            return JSON.parse(line);
          } catch (parseError) {
            // 继续尝试上一行
            continue;
          }
        }
      }
      throw new Error(`Failed to parse JSON from stdout: ${stdout.substring(0, 500)}`);
    }
  }

  /**
   * 执行 Python 脚本的辅助方法
   */
  private async execPythonScript(
    srm: SandboxRuntimeManager,
    sandboxHandle: SandboxHandle,
    script: string,
    config: Record<string, any>,
    options?: { timeout?: number },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const workspaceRoot = sandboxHandle.workspaceRoot;
    const scriptPath = `${workspaceRoot}/douyin-script-${nanoid()}.py`;

    // 写入脚本文件
    await srm.writeFile(sandboxHandle, scriptPath, script);

    // 将 workspaceRoot 添加到配置中，供 Python 脚本使用
    const configWithWorkspace = {
      ...config,
      workspaceRoot,
    };

    // 将配置 JSON 作为命令行参数传递（使用单引号包裹以避免 shell 转义问题）
    const configJson = JSON.stringify(configWithWorkspace);
    const command = `python3 ${scriptPath} '${configJson.replace(/'/g, "'\\''")}'`;

    // 执行脚本文件
    const result = await srm.exec(sandboxHandle, command, {
      timeout: options?.timeout,
    });

    return result;
  }

  /**
   * 解析抖音视频信息
   */
  async parseVideo(
    sessionId: string,
    url: string,
  ): Promise<DouyinActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await getSandboxHandleFromState(sessionId);

      if (!sandboxHandle) {
        return {
          success: false,
          error: 'Sandbox not found. Please ensure sandbox is initialized.',
        };
      }

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        parseVideoScript,
        {
          url,
        },
        {
          timeout: 120, // 2 分钟超时
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to parse video: ${result.stderr || result.stdout}`,
        };
      }

      let videoInfo: any;
      try {
        videoInfo = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse script output: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!videoInfo.success) {
        return {
          success: false,
          error: videoInfo.error || 'Failed to parse video info',
        };
      }

      return {
        success: true,
        data: videoInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 下载抖音视频
   */
  async downloadVideo(
    sessionId: string,
    url: string,
    options?: { quality?: 'highest' | 'high' | 'medium' | 'low' },
  ): Promise<DouyinActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await getSandboxHandleFromState(sessionId);

      if (!sandboxHandle) {
        return {
          success: false,
          error: 'Sandbox not found. Please ensure sandbox is initialized.',
        };
      }

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        downloadVideoScript,
        {
          url,
          quality: options?.quality || 'highest',
        },
        {
          timeout: 600, // 10 分钟超时（下载可能需要更长时间）
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to download video: ${result.stderr || result.stdout}`,
        };
      }

      let downloadResult: any;
      try {
        downloadResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse script output: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!downloadResult.success) {
        return {
          success: false,
          error: downloadResult.error || 'Failed to download video',
        };
      }

      // 如果有下载文件，读取并上传到 storage
      if (downloadResult.downloadFile) {
        try {
          const fileContentBase64 = await srm.readFile(sandboxHandle, downloadResult.downloadFile);
          const fileBuffer = Buffer.from(fileContentBase64, 'base64');

          // 从文件名推断 MIME 类型
          const fileName = downloadResult.fileName || 'video.mp4';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          const mimeTypes: Record<string, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mkv: 'video/x-matroska',
            flv: 'video/x-flv',
          };
          const mimeType = mimeTypes[ext] || 'video/mp4';

          // 上传到 storage（这里需要导入 storage，但为了简化，先返回文件路径）
          // 实际使用时应该在 executor 中处理上传
          downloadResult.fileBuffer = fileBuffer;
          downloadResult.mimeType = mimeType;
        } catch (error) {
          console.error('[DouyinRuntimeManager] Failed to read download file:', error);
          // 继续执行，不阻止返回结果
        }
      }

      return {
        success: true,
        data: downloadResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 全局实例
 */
let douyinRuntimeManager: DouyinRuntimeManager | null = null;

export function getDouyinRuntimeManager(): DouyinRuntimeManager {
  if (!douyinRuntimeManager) {
    douyinRuntimeManager = new DouyinRuntimeManager();
  }
  return douyinRuntimeManager;
}
