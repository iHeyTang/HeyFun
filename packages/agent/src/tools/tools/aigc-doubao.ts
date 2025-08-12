import { DoubaoService } from '../../aigc/services/doubao';
import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';
import { FileSystemTool } from './file-system';
import * as path from 'path';

// 为每个操作定义独立的参数接口
interface Seedream30T2iParameters extends BaseToolParameters {
  prompt: string;
  response_format?: 'url' | 'b64_json';
  size?: '1024x1024' | '864x1152' | '1152x864' | '1280x720' | '720x1280' | '832x1248' | '1248x832' | '1512x648';
  seed?: number;
  guidance_scale?: number;
  watermark?: boolean;
  save_directory?: string;
  custom_filename?: string;
}

interface SeedEdit30I2iParameters extends BaseToolParameters {
  prompt: string;
  image: string;
  response_format?: 'url' | 'b64_json';
  size?: 'adaptive';
  seed?: number;
  guidance_scale?: number;
  watermark?: boolean;
  save_directory?: string;
  custom_filename?: string;
}

interface Seedance10ProParameters extends BaseToolParameters {
  model: 'doubao-seedance-1-0-pro-250528' | 'doubao-seedance-1-0-lite-t2v-250428' | 'doubao-seedance-1-0-lite-i2v-250428';
  content: Array<{ type: 'text'; text: string } | { type: 'image'; image_url: { url: string }; role: 'first_frame' | 'last_frame' }>;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

// 新的参数结构：使用不同的key来区分不同的操作类型
interface DoubaoToolParameters extends BaseToolParameters {
  seedream_30_t2i?: Seedream30T2iParameters;
  seed_edit_30_i2i?: SeedEdit30I2iParameters;
  seedance_10_pro?: Seedance10ProParameters;
}

/**
 * 豆包AI工具 - 支持文生图、图生图、视频生成等功能
 *
 * 注意：此工具需要配置火山引擎API的访问密钥才能正常工作
 * 环境变量：
 * - VOLC_ACCESSKEY
 * - VOLC_SECRETKEY
 * - VOLC_REGION
 *
 * 特性：
 * - 异步接口自动包装成同步接口
 * - 内部实现智能轮询
 * - 支持超时和重试机制
 * - 自动保存二进制结果到本地或处理URL结果
 */
export class DoubaoTool extends AbstractBaseTool<DoubaoToolParameters> {
  public name = 'doubao_aigc';
  public description =
    '豆包AI工具，支持文生图、图生图、视频生成等多种AI生成功能。异步任务会自动轮询直到完成，支持超时配置。当结果是二进制数据时会自动保存到本地。';

  private doubaoService: DoubaoService;
  private fileSystemTool: FileSystemTool;

  constructor() {
    super();
    this.doubaoService = new DoubaoService();
    this.fileSystemTool = new FileSystemTool();
  }

  async execute(params: DoubaoToolParameters): Promise<ToolResult> {
    try {
      // 检查环境变量配置
      if (!process.env.VOLCENGINE_ARK_ACCESS_KEY_ID) {
        return {
          content: [
            {
              type: 'text',
              text: '错误：豆包AI工具未配置。请设置环境变量 VOLCENGINE_ARK_ACCESS_KEY_ID',
            },
          ],
          isError: true,
        };
      }

      // 检查参数结构，确定操作类型
      if (params.seedream_30_t2i) {
        return await this.executeSeedream30T2i(params.seedream_30_t2i);
      } else if (params.seed_edit_30_i2i) {
        return await this.executeSeedEdit30I2i(params.seed_edit_30_i2i);
      } else if (params.seedance_10_pro) {
        return await this.executeSeedance10ProWithPolling(params.seedance_10_pro);
      } else {
        return {
          content: [{ type: 'text', text: '错误：请指定一个操作类型，例如 seedream_30_t2i, seed_edit_30_i2i, seedance_10_pro' }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `豆包AI工具执行失败: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * 通用轮询函数
   */
  private async pollUntilComplete<T>(
    submitFn: () => Promise<{ id: string }>,
    getResultFn: (taskId: string) => Promise<T>,
    checkStatusFn: (result: T) => 'pending' | 'done' | 'error',
    maxWaitTime: number = 300,
    pollInterval: number = 5,
  ): Promise<T> {
    try {
      // 提交任务
      const submitResult = await submitFn();
      const taskId = submitResult.id;

      // 开始轮询
      const startTime = Date.now();
      const maxWaitTimeMs = maxWaitTime * 1000;
      const pollIntervalMs = pollInterval * 1000;

      while (true) {
        // 检查是否超时
        if (Date.now() - startTime > maxWaitTimeMs) {
          throw new Error(`任务执行超时（${maxWaitTime}秒）。任务ID: ${taskId}，请稍后手动查询结果。`);
        }

        // 获取任务状态
        const result = await getResultFn(taskId);
        const status = checkStatusFn(result);

        // 检查任务状态
        if (status === 'done') {
          // 任务完成
          return result;
        } else if (status === 'error') {
          throw new Error(`任务执行失败: ${taskId}`);
        } else {
          // 任务还在进行中，等待后继续轮询
          await this.sleep(pollIntervalMs);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`轮询过程中发生错误: ${errorMessage}`);
    }
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 从URL下载文件并保存到本地
   */
  private async downloadAndSaveFromUrl(
    url: string,
    operationType: string,
    prompt: string,
    fileExtension: string = 'png',
    saveDirectory?: string,
    customFilename?: string,
  ): Promise<{ savedFiles: string[]; message: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedPrompt = prompt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);

      // 创建输出目录
      const outputDir = saveDirectory || `./doubao_output/${operationType}/${timestamp}_${sanitizedPrompt}`;
      const fileName = customFilename ? `${customFilename}.${fileExtension}` : `output_1.${fileExtension}`;
      const filePath = path.join(outputDir, fileName);

      // 下载文件
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');

      // 保存到本地
      const result = await this.fileSystemTool.execute({
        operation: 'write_binary',
        path: filePath,
        binary_data: base64Data,
      });

      if (!result.isError) {
        return {
          savedFiles: [filePath],
          message: `\n✅ 已自动下载并保存文件到本地:\n  - ${filePath}`,
        };
      } else {
        return {
          savedFiles: [],
          message: `\n⚠️ 保存下载文件失败: ${result.error}`,
        };
      }
    } catch (error) {
      console.error('下载并保存文件失败:', error);
      return {
        savedFiles: [],
        message: `\n⚠️ 下载并保存文件时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  private async executeSeedream30T2i(params: Seedream30T2iParameters): Promise<ToolResult> {
    try {
      // 调用真实的豆包API
      const response = await this.doubaoService.seedream30T2i({
        model: 'doubao-seedream-3-0-t2i-250415',
        prompt: params.prompt,
        response_format: params.response_format || 'url',
        size: params.size || '1024x1024',
        seed: params.seed || -1,
        guidance_scale: params.guidance_scale || 2.5,
        watermark: params.watermark ?? true,
      });

      if (response.data && response.data.length > 0) {
        // 处理响应，自动保存图片
        const savedFiles: string[] = [];
        const imageContents: any[] = [];

        for (let i = 0; i < response.data.length; i++) {
          const imageUrl = response.data[i]?.url;
          if (imageUrl) {
            const result = await this.downloadAndSaveFromUrl(
              imageUrl,
              'seedream_30_t2i',
              params.prompt,
              'png',
              params.save_directory,
              params.custom_filename,
            );
            savedFiles.push(...result.savedFiles);
          }
        }

        return {
          content: [
            { type: 'text', text: `豆包文生图3.0生成成功！` },
            { type: 'text', text: `提示词: ${params.prompt}` },
            { type: 'text', text: `生成了 ${response.data.length} 张图片` },
            ...savedFiles.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
          ],
        };
      } else {
        return {
          content: [{ type: 'text', text: `生成失败：响应数据为空` }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `文生图执行失败: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async executeSeedEdit30I2i(params: SeedEdit30I2iParameters): Promise<ToolResult> {
    try {
      // 调用真实的豆包API
      const response = await this.doubaoService.seedEdit30I2i({
        model: 'doubao-seededit-3-0-i2i-250628',
        prompt: params.prompt,
        image: params.image,
        response_format: params.response_format || 'url',
        size: params.size || 'adaptive',
        seed: params.seed || -1,
        guidance_scale: params.guidance_scale || 5.5,
        watermark: params.watermark ?? true,
      });

      if (response.data && response.data.length > 0) {
        // 处理响应，自动保存图片
        const savedFiles: string[] = [];

        for (let i = 0; i < response.data.length; i++) {
          const imageUrl = response.data[i]?.url;
          if (imageUrl) {
            const result = await this.downloadAndSaveFromUrl(
              imageUrl,
              'seed_edit_30_i2i',
              params.prompt,
              'png',
              params.save_directory,
              params.custom_filename,
            );
            savedFiles.push(...result.savedFiles);
          }
        }

        return {
          content: [
            { type: 'text', text: `豆包图生图3.0生成成功！` },
            { type: 'text', text: `提示词: ${params.prompt}` },
            { type: 'text', text: `生成了 ${response.data.length} 张图片` },
            ...savedFiles.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
          ],
        };
      } else {
        return {
          content: [{ type: 'text', text: `生成失败：响应数据为空` }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `图生图执行失败: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async executeSeedance10ProWithPolling(params: Seedance10ProParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.doubaoService.seedanceSubmit({
          model: params.model,
          content: params.content,
        });
        return { id: response.id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.doubaoService.seedanceGetResult({
          id: taskId,
        });

        let savedFiles: string[] = [];
        let message = '';
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.status === 'succeeded' && response.content.video_url) {
          try {
            const promptText = params.content.find(c => c.type === 'text')?.text || '视频生成';
            const result = await this.downloadAndSaveFromUrl(
              response.content.video_url,
              'seedance_10_pro',
              promptText,
              'mp4',
              params.save_directory,
              params.custom_filename,
            );
            savedFiles = result.savedFiles;
            message = result.message;
          } catch (error) {
            console.warn('下载视频失败:', error);
            message = `\n⚠️ 下载视频失败: ${error instanceof Error ? error.message : '未知错误'}`;
          }
        }

        return {
          status: response.status,
          video_url: response.content.video_url,
          saved_files: savedFiles,
          message: message,
          error: response.error,
        };
      },
      result => {
        if (result.status === 'succeeded') {
          return 'done';
        } else if (result.status === 'queued' || result.status === 'running') {
          return 'pending';
        } else if (result.status === 'failed' || result.status === 'cancelled') {
          return 'error';
        } else {
          return 'pending';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      const promptText = params.content.find(c => c.type === 'text')?.text || '视频生成';
      return {
        content: [
          { type: 'text', text: `豆包视频生成成功！` },
          { type: 'text', text: `模型: ${params.model}` },
          { type: 'text', text: `内容: ${promptText}` },
          { type: 'text', text: `视频URL: ${result.video_url}` },
          { type: 'text', text: result.message },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      description: '豆包AI工具参数',
      properties: {
        seedream_30_t2i: {
          type: 'object',
          description: '豆包文生图3.0参数（同步）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            response_format: { type: 'string', enum: ['url', 'b64_json'], description: '响应格式', default: 'url' },
            size: {
              type: 'string',
              enum: ['1024x1024', '864x1152', '1152x864', '1280x720', '720x1280', '832x1248', '1248x832', '1512x648'],
              description: '图片尺寸',
              default: '1024x1024',
            },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            guidance_scale: { type: 'number', minimum: 1, maximum: 10, description: '引导强度', default: 2.5 },
            watermark: { type: 'boolean', description: '是否添加水印', default: true },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
        },
        seed_edit_30_i2i: {
          type: 'object',
          description: '豆包图生图3.0参数（同步）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            image: { type: 'string', description: '输入图片的base64编码或URL' },
            response_format: { type: 'string', enum: ['url', 'b64_json'], description: '响应格式', default: 'url' },
            size: { type: 'string', enum: ['adaptive'], description: '图片尺寸', default: 'adaptive' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            guidance_scale: { type: 'number', minimum: 1, maximum: 10, description: '引导强度', default: 5.5 },
            watermark: { type: 'boolean', description: '是否添加水印', default: true },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt', 'image'],
        },
        seedance_10_pro: {
          type: 'object',
          description: '豆包视频生成参数（内部轮询）',
          properties: {
            model: {
              type: 'string',
              enum: ['doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-lite-i2v-250428'],
              description: '使用的模型',
            },
            content: {
              type: 'array',
              description: '内容数组，包含文本或图片',
              items: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['text'] },
                      text: { type: 'string' },
                    },
                    required: ['type', 'text'],
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['image'] },
                      image_url: {
                        type: 'object',
                        properties: {
                          url: { type: 'string' },
                        },
                        required: ['url'],
                      },
                      role: { type: 'string', enum: ['first_frame', 'last_frame'] },
                    },
                    required: ['type', 'image_url', 'role'],
                  },
                ],
              },
            },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['model', 'content'],
        },
      },
      // 确保至少有一个操作类型被指定
      anyOf: [{ required: ['seedream_30_t2i'] }, { required: ['seed_edit_30_i2i'] }, { required: ['seedance_10_pro'] }],
    };
  }
}
