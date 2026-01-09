/**
 * Playwright Browser Provider
 * 在 sandbox 中运行浏览器，通过 sandbox 执行浏览器操作
 */

import { BrowserRuntimeManager, BrowserRuntimeInstance, BrowserActionResult } from '../runtime-manager';
import { BrowserHandle, createBrowserHandle, updateBrowserHandleStatus, updateBrowserHandleUrl, updateBrowserHandleLastUsed } from '../handle';
import { saveBrowserHandleToState } from '@/agents/tools/browser/utils';
import { nanoid } from 'nanoid';
import { getSandboxRuntimeManager, type SandboxRuntimeManager } from '@/lib/server/sandbox';
import type { SandboxHandle } from '@/lib/server/sandbox/handle';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';

// 直接导入 Python 脚本，webpack 会将其作为字符串内联
import checkBrowserScript from '../scripts/check-browser.py';
import navigateScript from '../scripts/navigate.py';
import clickScript from '../scripts/click.py';
import clickAtScript from '../scripts/click-at.py';
import scrollScript from '../scripts/scroll.py';
import typeScript from '../scripts/type.py';
import extractContentScript from '../scripts/extract-content.py';
import screenshotScript from '../scripts/screenshot.py';
import downloadScript from '../scripts/download.py';
import browserLauncherScript from '../scripts/browser-launcher.py';
import browserServerScript from '../scripts/browser-server.py';

/**
 * Playwright BRM 实现
 * 浏览器在 sandbox 中运行，所有操作通过 sandbox 执行
 */
export class PlaywrightBrowserRuntimeManager implements BrowserRuntimeManager {
  // 存储每个 session 的 HTTP server 端口
  private serverPorts = new Map<string, number>();

  /**
   * 从 Python 脚本输出中解析 JSON
   * 由于 stderr 可能被重定向到 stdout，尝试从最后一行解析 JSON
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
   * 将脚本写入临时文件，然后执行文件，通过命令行参数传递配置 JSON
   */
  private async execPythonScript(
    srm: SandboxRuntimeManager,
    sandboxHandle: SandboxHandle,
    script: string,
    config: Record<string, any>,
    options?: { timeout?: number },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const workspaceRoot = sandboxHandle.workspaceRoot;
    const scriptPath = `${workspaceRoot}/browser-script-${nanoid()}.py`;

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
   * 启动浏览器 HTTP Server（如果尚未启动）
   */
  private async ensureBrowserServer(
    sandboxHandle: SandboxHandle,
    handle: BrowserHandle,
    sessionId: string,
  ): Promise<number> {
    // 检查是否已有 server 端口
    const existingPort = this.serverPorts.get(sessionId);
    if (existingPort) {
      return existingPort;
    }

    const srm = getSandboxRuntimeManager();
    const workspaceRoot = sandboxHandle.workspaceRoot;
    const serverPort = 8888; // 固定端口

    // 写入 server 脚本
    const serverScriptPath = `${workspaceRoot}/browser-server-${nanoid()}.py`;
    await srm.writeFile(sandboxHandle, serverScriptPath, browserServerScript);

    // 启动 server（后台运行）
    const configJson = JSON.stringify({
      port: serverPort,
      workspaceRoot,
      stateFilePath: handle.stateFilePath,
      wsEndpoint: handle.wsEndpoint,
    }).replace(/'/g, "'\\''");

    const startCommand = `nohup python3 ${serverScriptPath} '${configJson}' > ${workspaceRoot}/browser-server.log 2>&1 & echo $!`;
    const startResult = await srm.exec(sandboxHandle, startCommand, { timeout: 10 });

    if (startResult.exitCode !== 0) {
      throw new Error(`Failed to start browser server: ${startResult.stderr || startResult.stdout}`);
    }

    // 等待 server 启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 存储端口
    this.serverPorts.set(sessionId, serverPort);
    return serverPort;
  }

  /**
   * 通过 HTTP 请求调用浏览器操作
   */
  private async callBrowserServer(
    sandboxHandle: SandboxHandle,
    endpoint: string,
    data: Record<string, any>,
    sessionId: string,
    handle?: BrowserHandle,
  ): Promise<any> {
    const browserHandle = handle || data.handle || {};
    const serverPort = await this.ensureBrowserServer(sandboxHandle, browserHandle, sessionId);

    // 获取 server URL（通过 sandbox 的 previewUrls 或直接使用 localhost）
    let serverUrl: string;
    if (sandboxHandle.previewUrls && sandboxHandle.previewUrls[serverPort]) {
      serverUrl = sandboxHandle.previewUrls[serverPort];
    } else {
      // 如果没有 previewUrl，通过 sandbox 内部访问
      // 使用 curl 在 sandbox 内部调用
      const requestBody = JSON.stringify(data);
      const curlCommand = `curl -s -X POST http://localhost:${serverPort}${endpoint} -H "Content-Type: application/json" -d '${requestBody.replace(/'/g, "'\\''")}'`;

      const srm = getSandboxRuntimeManager();
      const result = await srm.exec(sandboxHandle, curlCommand, { timeout: 60 });

      if (result.exitCode !== 0) {
        throw new Error(`HTTP request failed: ${result.stderr || result.stdout}`);
      }

      try {
        return JSON.parse(result.stdout);
      } catch (e) {
        throw new Error(`Failed to parse response: ${result.stdout}`);
      }
    }

    // 如果有外部 URL，直接通过 HTTP 请求
    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 读取文件并上传到 storage
   * 注意：sandbox.readFile 现在返回 base64 编码的字符串（修复了二进制文件读取问题）
   */
  private async readAndUploadFile(
    srm: SandboxRuntimeManager,
    sandboxHandle: SandboxHandle,
    filePath: string,
    organizationId: string,
    sessionId: string,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    // 读取文件内容（sandbox.readFile 返回 base64 编码的字符串）
    const fileContentBase64 = await srm.readFile(sandboxHandle, filePath);
    const fileBuffer = Buffer.from(fileContentBase64, 'base64');

    // 上传到 storage
    const storage = (await import('@/lib/server/storage')).default;
    const fileKey = `${organizationId}/browser/${sessionId}/${Date.now()}_${nanoid(8)}_${fileName}`;
    await storage.put(fileKey, fileBuffer, {
      contentType: mimeType,
    });

    // 返回访问 URL
    return `/api/oss/${fileKey}`;
  }
  /**
   * 创建新的 browser 实例
   * 在指定的 sandbox 中启动浏览器
   */
  async create(sandboxId: string, sessionId: string, options?: { headless?: boolean; debugPort?: number }): Promise<BrowserHandle> {
    const browserId = nanoid();
    // sandbox 环境中默认使用 headless 模式（没有 X server）
    const headless = options?.headless ?? true;
    const debugPort = options?.debugPort ?? this.findAvailablePort();

    // 获取 sandbox（通过 sessionId 查找）
    const srm = getSandboxRuntimeManager();
    const sandboxHandle = await this.getSandboxHandleById(sandboxId, sessionId);

    // 使用 sandbox 的工作空间根路径
    const workspaceRoot = sandboxHandle.workspaceRoot;
    const stateFilePath = `${workspaceRoot}/.browser-state-${browserId}.json`;

    // 在 sandbox 中创建浏览器自动化脚本（如果还没有）
    await this.ensureBrowserScript(sandboxHandle);

    // 启动浏览器（在 sandbox 中作为后台进程运行）
    // 浏览器需要持续运行，所以我们启动一个后台进程
    const browserScriptPath = `${workspaceRoot}/browser-${browserId}.py`;
    const infoFilePath = browserScriptPath.replace('.py', '.json');

    // 写入浏览器启动脚本
    await srm.writeFile(sandboxHandle, browserScriptPath, browserLauncherScript);

    // 在后台启动浏览器（使用 nohup 或类似方式）
    const configJson = JSON.stringify({
      browserId,
      headless,
      debugPort,
      infoFilePath,
    }).replace(/'/g, "'\\''");
    const startCommand = `nohup python3 ${browserScriptPath} '${configJson}' > ${workspaceRoot}/browser-${browserId}.log 2>&1 & echo $!`;

    console.log(`[PlaywrightBRM] Starting browser: browserId=${browserId}, debugPort=${debugPort}, headless=${headless}, sandboxId=${sandboxId}`);
    const startResult = await srm.exec(sandboxHandle, startCommand, { timeout: 10 });

    if (startResult.exitCode !== 0) {
      console.error(`[PlaywrightBRM] Failed to start browser process:`, {
        exitCode: startResult.exitCode,
        stdout: startResult.stdout,
        stderr: startResult.stderr,
      });
      throw new Error(`Failed to start browser process: ${startResult.stderr || startResult.stdout}`);
    }

    const pid = startResult.stdout.trim();
    console.log(`[PlaywrightBRM] Browser process started with PID: ${pid}`);

    // 等待浏览器启动并读取浏览器信息
    const maxWaitTime = 20000; // 增加到 20 秒，给浏览器更多启动时间
    const checkInterval = 500; // 每 0.5 秒检查一次，更频繁
    let waited = 0;
    let browserInfo: any = null;
    const logPath = `${workspaceRoot}/browser-${browserId}.log`;

    while (waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;

      // 尝试读取浏览器信息文件
      const infoPath = browserScriptPath.replace('.py', '.json');
      try {
        const infoContentBase64 = await srm.readFile(sandboxHandle, infoPath);
        const infoContent = Buffer.from(infoContentBase64, 'base64').toString('utf-8');
        browserInfo = JSON.parse(infoContent);
        console.log(
          `[PlaywrightBRM] Browser info file found after ${waited}ms:`,
          JSON.stringify({
            browserId: browserInfo?.browserId,
            wsEndpoint: browserInfo?.wsEndpoint ? 'present' : 'missing',
            debugPort: browserInfo?.debugPort,
          }),
        );
        break;
      } catch (e) {
        // 文件还不存在，检查日志文件看是否有错误
        if (waited >= 2000) {
          // 等待至少 2 秒后再检查日志
          try {
            const logContentBase64 = await srm.readFile(sandboxHandle, logPath);
            const logContent = Buffer.from(logContentBase64, 'base64').toString('utf-8');
            // 检查日志中是否有错误
            if (logContent.includes('"success": false') || logContent.includes('error')) {
              try {
                // 尝试解析 JSON 错误
                const errorMatch = logContent.match(/\{"success":\s*false[^}]*\}/);
                if (errorMatch) {
                  const errorInfo = JSON.parse(errorMatch[0]);
                  console.warn(`[PlaywrightBRM] Browser startup error detected in log:`, errorInfo);
                }
              } catch (parseError) {
                // 无法解析 JSON，显示原始日志片段
                const logPreview = logContent.substring(0, 500);
                if (logPreview.includes('error') || logPreview.includes('Error') || logPreview.includes('Failed')) {
                  console.warn(`[PlaywrightBRM] Browser startup may have errors. Log preview:`, logPreview);
                }
              }
            }
          } catch (logError) {
            // 日志文件可能还不存在，继续等待
          }
        }

        // 继续等待
        if (waited < maxWaitTime) {
          continue;
        }
      }
    }

    // 如果文件读取失败，尝试通过 CDP 端点获取信息
    if (!browserInfo || !browserInfo.wsEndpoint) {
      console.log(`[PlaywrightBRM] Browser info file not found, trying CDP endpoint check...`);

      // 获取 sandbox 的 previewUrl（如果可用）
      // 对于 Daytona，previewUrls 是端口到 URL 的映射，用于外部访问
      const previewUrl = sandboxHandle.previewUrls?.[debugPort];
      const cdpHost = previewUrl ? new URL(previewUrl).hostname : 'localhost';

      console.log(`[PlaywrightBRM] Checking CDP endpoint:`, {
        debugPort,
        previewUrl: previewUrl || 'not found',
        previewUrls: sandboxHandle.previewUrls ? Object.keys(sandboxHandle.previewUrls).length + ' ports' : 'none',
        cdpHost,
        sandboxId,
      });

      const checkResult = await this.execPythonScript(
        srm,
        sandboxHandle,
        checkBrowserScript,
        {
          debugPort,
          browserId,
          maxRetries: 5,
          retryDelay: 2,
          cdpHost, // 传递主机名（localhost 或 previewUrl 的主机名）
        },
        { timeout: 15 },
      );

      if (checkResult.exitCode === 0) {
        try {
          browserInfo = JSON.parse(checkResult.stdout);
          console.log(`[PlaywrightBRM] CDP check successful:`, {
            success: browserInfo?.success,
            wsEndpoint: browserInfo?.wsEndpoint ? 'present' : 'missing',
            debugPort: browserInfo?.debugPort,
          });
        } catch (parseError) {
          console.error(`[PlaywrightBRM] Failed to parse CDP check result:`, {
            stdout: checkResult.stdout,
            stderr: checkResult.stderr,
            parseError,
          });
          throw new Error(`Failed to parse browser check result: ${checkResult.stdout}`);
        }
      } else {
        // 尝试读取日志文件以获取更多信息
        const logPath = `${workspaceRoot}/browser-${browserId}.log`;
        let logContent = '';
        try {
          const logContentBase64 = await srm.readFile(sandboxHandle, logPath);
          logContent = Buffer.from(logContentBase64, 'base64').toString('utf-8');
        } catch (logError) {
          // 日志文件可能不存在
        }

        // 尝试读取完整的日志文件
        let fullLogContent = '';
        try {
          const fullLogContentBase64 = await srm.readFile(sandboxHandle, logPath);
          fullLogContent = Buffer.from(fullLogContentBase64, 'base64').toString('utf-8');
        } catch (logError) {
          // 日志文件可能不存在
        }

        console.error(`[PlaywrightBRM] CDP check failed:`, {
          exitCode: checkResult.exitCode,
          stdout: checkResult.stdout,
          stderr: checkResult.stderr,
          logContent: fullLogContent || logContent.substring(0, 1000), // 显示更多日志内容
          debugPort,
          sandboxId,
          previewUrl: sandboxHandle.previewUrls?.[debugPort] || 'not found',
        });

        throw new Error(
          `Failed to start browser: ${checkResult.stderr || checkResult.stdout}. ` +
            `Debug port: ${debugPort}, Sandbox: ${sandboxId}, PreviewUrl: ${sandboxHandle.previewUrls?.[debugPort] || 'not found'}. ` +
            (fullLogContent || logContent ? `Log: ${(fullLogContent || logContent).substring(0, 500)}` : 'No log file found'),
        );
      }
    }

    // 如果从文件读取，可能没有 success 字段，需要检查 wsEndpoint
    if (!browserInfo || (!browserInfo.success && !browserInfo.wsEndpoint)) {
      throw new Error(browserInfo?.error || 'Failed to start browser');
    }

    // 确保有 success 字段（从文件读取时可能没有）
    if (!browserInfo.success) {
      browserInfo.success = true;
    }

    const handle = createBrowserHandle(browserId, 'playwright', sandboxId, {
      status: 'ready',
      debugPort,
      wsEndpoint: browserInfo.wsEndpoint,
      stateFilePath,
    });

    return handle;
  }

  /**
   * 根据 handle 恢复/获取已存在的 browser 实例
   */
  async get(handle: BrowserHandle): Promise<BrowserRuntimeInstance> {
    // 浏览器在 sandbox 中运行，这里只需要验证 sandbox 是否可用
    const srm = getSandboxRuntimeManager();
    const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId);

    // 恢复浏览器状态
    await this.restoreState(handle);

    return {
      handle: updateBrowserHandleStatus(handle, 'ready'),
    };
  }

  /**
   * 导航到指定 URL
   */
  async navigate(
    handle: BrowserHandle,
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number; sessionId?: string; organizationId?: string },
  ): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        navigateScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          url,
          waitUntil: options?.waitUntil || 'load',
          timeout: options?.timeout || 30000,
        },
        {
          timeout: Math.max((options?.timeout || 30000) / 1000 + 10, 60),
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!browserResult.success) {
        return {
          success: false,
          error: browserResult.error || 'Navigation failed',
        };
      }

      // 如果有截图文件，读取并上传到 storage
      if (browserResult.screenshotFile && options?.sessionId) {
        try {
          const screenshotUrl = await this.readAndUploadFile(
            srm,
            sandboxHandle,
            browserResult.screenshotFile,
            options.organizationId || '',
            options.sessionId,
            'screenshot.png',
            'image/png',
          );
          browserResult.screenshot = screenshotUrl;
          delete browserResult.screenshotFile;
        } catch (error) {
          console.error('[PlaywrightBRM] Failed to upload screenshot:', error);
          // 继续执行，不阻止返回结果
        }
      }

      // 更新 handle 的当前 URL（在返回的数据中包含，供调用者保存到 Redis）
      const updatedHandle = updateBrowserHandleUrl(handle, url);
      browserResult.currentUrl = url;

      return {
        success: true,
        data: browserResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 点击元素
   */
  async click(handle: BrowserHandle, selector: string, options?: { timeout?: number; sessionId?: string }): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      // 尝试连接到已运行的浏览器，如果失败则启动新浏览器
      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        clickScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          selector,
          timeout: options?.timeout || 10000,
          currentUrl: handle.currentUrl,
        },
        {
          timeout: Math.max((options?.timeout || 10000) / 1000 + 10, 30),
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 坐标点击
   */
  async clickAt(handle: BrowserHandle, x: number, y: number, options?: { sessionId?: string }): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        clickAtScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          x,
          y,
          currentUrl: handle.currentUrl,
        },
        { timeout: 30 },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 滚动页面
   */
  async scroll(handle: BrowserHandle, deltaX: number, deltaY: number, options?: { sessionId?: string }): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        scrollScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          deltaX,
          deltaY,
          currentUrl: handle.currentUrl,
        },
        { timeout: 30 },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 输入文本
   */
  async type(
    handle: BrowserHandle,
    selector: string,
    text: string,
    options?: { timeout?: number; sessionId?: string },
  ): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        typeScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          selector,
          text,
          timeout: options?.timeout || 10000,
          currentUrl: handle.currentUrl,
        },
        {
          timeout: Math.max((options?.timeout || 10000) / 1000 + 10, 30),
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 提取页面内容
   */
  async extractContent(
    handle: BrowserHandle,
    options?: { selector?: string; extractType?: 'text' | 'html' | 'markdown'; sessionId?: string; organizationId?: string },
  ): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      // 使用 HTTP server 方式调用
      const browserResult = await this.callBrowserServer(
        sandboxHandle,
        '/extract-content',
        {
          selector: options?.selector,
          extractType: options?.extractType || 'markdown',
          currentUrl: handle.currentUrl,
        },
        options?.sessionId || '',
        handle,
      );

      // 统一采用文件读写方式：总是从文件读取内容
      if (browserResult.success && browserResult.contentFile) {
        try {
          // 从文件读取内容（统一方式）
          const fileContent = await srm.readFile(sandboxHandle, browserResult.contentFile);
          const content = Buffer.from(fileContent, 'base64').toString('utf-8');
          browserResult.content = content;

          // 如果有 sessionId 和 organizationId，上传到 storage
          if (options?.sessionId && options?.organizationId) {
            try {
              const contentType = browserResult.contentType || 'text';
              const fileExt = contentType === 'html' ? 'html' : contentType === 'markdown' ? 'md' : 'txt';
              const mimeType = contentType === 'html' ? 'text/html' : contentType === 'markdown' ? 'text/markdown' : 'text/plain';
              const contentUrl = await this.readAndUploadFile(
                srm,
                sandboxHandle,
                browserResult.contentFile,
                options.organizationId,
                options.sessionId,
                `content.${fileExt}`,
                mimeType,
              );
              browserResult.contentUrl = contentUrl;
            } catch (error) {
              console.error('[PlaywrightBRM] Failed to upload content file:', error);
              // 继续执行，不阻止返回结果
            }
          }

          // 删除文件路径，只保留内容
          delete browserResult.contentFile;
        } catch (error) {
          return {
            success: false,
            error: `Failed to read content file: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      } else if (browserResult.success && browserResult.content) {
        // 容错处理：如果文件保存失败，Python 脚本可能会回退到 stdout 传递小内容（<10KB）
        // 这种情况应该很少发生，但保留兼容性处理
        console.warn('[PlaywrightBRM] Content found in stdout (fallback mode), file save may have failed');
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 截图
   */
  async screenshot(
    handle: BrowserHandle,
    options?: { fullPage?: boolean; format?: 'png' | 'jpeg'; sessionId?: string; organizationId?: string },
  ): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        screenshotScript,
        {
          wsEndpoint: handle.wsEndpoint, // 传递 WebSocket endpoint，连接到已存在的浏览器
          stateFilePath: handle.stateFilePath,
          currentUrl: handle.currentUrl,
          fullPage: options?.fullPage || false,
          format: options?.format || 'png',
        },
        { timeout: 30 },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      // 如果有截图文件，读取并上传到 storage
      if (browserResult.screenshotFile && options?.sessionId && options?.organizationId) {
        try {
          const screenshotUrl = await this.readAndUploadFile(
            srm,
            sandboxHandle,
            browserResult.screenshotFile,
            options.organizationId,
            options.sessionId,
            `screenshot.${browserResult.format || 'png'}`,
            browserResult.format === 'jpeg' ? 'image/jpeg' : 'image/png',
          );
          browserResult.screenshot = screenshotUrl;
          delete browserResult.screenshotFile;
        } catch (error) {
          console.error('[PlaywrightBRM] Failed to upload screenshot:', error);
          // 继续执行，不阻止返回结果
        }
      }

      return {
        success: browserResult.success || false,
        data: browserResult,
        error: browserResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 下载资源
   */
  async download(
    handle: BrowserHandle,
    url: string,
    options?: { timeout?: number; sessionId?: string; organizationId?: string; keepFile?: boolean },
  ): Promise<BrowserActionResult> {
    try {
      const srm = getSandboxRuntimeManager();
      const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId, options?.sessionId);

      const result = await this.execPythonScript(
        srm,
        sandboxHandle,
        downloadScript,
        {
          wsEndpoint: handle.wsEndpoint,
          stateFilePath: handle.stateFilePath,
          url,
          timeout: options?.timeout || 60000,
          currentUrl: handle.currentUrl,
        },
        {
          timeout: Math.max((options?.timeout || 60000) / 1000 + 10, 120),
        },
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Browser automation failed: ${result.stderr || result.stdout}`,
        };
      }

      let browserResult: any;
      try {
        browserResult = this.parseScriptOutput(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse browser result: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!browserResult.success) {
        return {
          success: false,
          error: browserResult.error || 'Download failed',
        };
      }

      // 如果有下载文件，读取并上传到 storage
      if (browserResult.downloadFile && options?.sessionId && options?.organizationId) {
        try {
          // 从文件名推断 MIME 类型
          const fileName = browserResult.fileName || 'download';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          const mimeTypes: Record<string, string> = {
            pdf: 'application/pdf',
            zip: 'application/zip',
            txt: 'text/plain',
            json: 'application/json',
            xml: 'application/xml',
            html: 'text/html',
            css: 'text/css',
            js: 'application/javascript',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            mp4: 'video/mp4',
            mp3: 'audio/mpeg',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          };
          const mimeType = mimeTypes[ext] || 'application/octet-stream';

          const downloadUrl = await this.readAndUploadFile(
            srm,
            sandboxHandle,
            browserResult.downloadFile,
            options.organizationId,
            options.sessionId,
            fileName,
            mimeType,
          );
          browserResult.downloadUrl = downloadUrl;

          // 如果 keepFile 为 true，保留文件路径（用于后续保存到资源库）
          if (!options.keepFile) {
            delete browserResult.downloadFile;
          }
        } catch (error) {
          console.error('[PlaywrightBRM] Failed to upload download file:', error);
          // 继续执行，不阻止返回结果
        }
      }

      const updatedHandle = updateBrowserHandleLastUsed(handle);
      await saveBrowserHandleToState(options?.sessionId || '', updatedHandle);

      return {
        success: true,
        data: browserResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 保存浏览器状态（cookies、localStorage 等）
   * 状态保存在 sandbox 的文件系统中
   */
  async saveState(handle: BrowserHandle): Promise<void> {
    // 状态已经在每次操作后自动保存到 sandbox 文件系统
    // 这个方法可以用于显式保存状态
  }

  /**
   * 恢复浏览器状态（cookies、localStorage 等）
   * 从 sandbox 的文件系统中恢复
   */
  async restoreState(handle: BrowserHandle): Promise<void> {
    // 状态会在每次操作时自动恢复
    // 这个方法可以用于显式恢复状态
  }

  /**
   * 删除 browser 实例
   */
  async destroy(handle: BrowserHandle): Promise<BrowserHandle> {
    // 删除状态文件（可选）
    const srm = getSandboxRuntimeManager();
    const sandboxHandle = await this.getSandboxHandleById(handle.sandboxId);
    try {
      await srm.exec(sandboxHandle, `rm -f ${handle.stateFilePath}`, { timeout: 5 });
    } catch (e) {
      // 忽略错误
    }

    return updateBrowserHandleStatus(handle, 'expired');
  }

  /**
   * 查找可用端口（简化实现）
   */
  private findAvailablePort(): number {
    return 9222 + Math.floor(Math.random() * 1000);
  }

  /**
   * 验证 playwright 是否可用（sandbox 应该已预装）
   */
  private async ensureBrowserScript(sandboxHandle: SandboxHandle): Promise<void> {
    const srm = getSandboxRuntimeManager();

    // 简单验证 playwright 是否可用（sandbox 应该已预装）
    const checkPlaywrightResult = await srm.exec(sandboxHandle, 'python3 -c "import playwright; print(\'OK\')" 2>&1', { timeout: 5 });

    if (checkPlaywrightResult.exitCode !== 0 || !checkPlaywrightResult.stdout.includes('OK')) {
      throw new Error(
        `Playwright is not available in sandbox. Please ensure playwright is pre-installed in the sandbox image. ` +
          `Error: ${checkPlaywrightResult.stderr || checkPlaywrightResult.stdout}`,
      );
    }
  }

  /**
   * 根据 sandboxId 获取 SandboxHandle
   * 注意：这里需要传入 sessionId 来获取 sandbox handle
   * 因为 browser handle 包含 sandboxId，但我们需要通过 sessionId 来查找
   */
  private async getSandboxHandleById(sandboxId: string, sessionId?: string): Promise<SandboxHandle> {
    // 如果有 sessionId，优先通过 sessionId 获取
    if (sessionId) {
      const handle = await getSandboxHandleFromState(sessionId);
      if (handle) {
        // 验证 sandboxId 是否匹配（如果提供了 sandboxId）
        if (!sandboxId || handle.id === sandboxId) {
          return handle;
        }
        // 如果 sandboxId 不匹配，说明可能 sandbox 被重新创建了，返回当前的 handle
        console.warn(`[PlaywrightBRM] Sandbox ID mismatch: expected ${sandboxId}, got ${handle.id}. Using current sandbox.`);
        return handle;
      }
    }

    // 如果没有 sessionId 或找不到，尝试通过 sandboxId 直接查找（需要实现）
    // 这里可以扩展为通过 Redis 存储 sandboxId -> SandboxHandle 的映射
    throw new Error(`Sandbox ${sandboxId} not found. Please provide sessionId.`);
  }
}
