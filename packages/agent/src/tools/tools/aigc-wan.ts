import { WanService } from '../../aigc/services/wan';
import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';
import { FileSystemTool } from './file-system';
import * as path from 'path';

// 为每个操作定义独立的参数接口
interface T2iParameters extends BaseToolParameters {
  model: 'wan2.2-t2i-flash' | 'wan2.2-t2i-plus' | 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus' | 'wanx2.0-t2i-turbo';
  prompt: string;
  negative_prompt?: string;
  size?: string;
  n?: number;
  seed?: number;
  prompt_extend?: boolean;
  watermark?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface I2vParameters extends BaseToolParameters {
  model: 'wan2.2-i2v-flash' | 'wan2.2-i2v-plus' | 'wanx2.1-i2v-plus' | 'wanx2.1-i2v-turbo';
  prompt?: string;
  negative_prompt?: string;
  image_url: string;
  resolution?: '480P' | '720P' | '1080P';
  duration?: number;
  prompt_extend?: boolean;
  seed?: number;
  watermark?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface T2vParameters extends BaseToolParameters {
  model: 'wan2.2-t2v-plus' | 'wanx2.1-t2v-turbo' | 'wanx2.1-t2v-plus';
  prompt?: string;
  negative_prompt?: string;
  size?: string;
  duration?: number;
  prompt_extend?: boolean;
  seed?: number;
  watermark?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface Kf2vParameters extends BaseToolParameters {
  model: 'wanx2.1-kf2v-plus';
  prompt?: string;
  negative_prompt?: string;
  first_frame_url: string;
  last_frame_url: string;
  resolution?: '720P';
  duration?: number;
  prompt_extend?: boolean;
  seed?: number;
  watermark?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

// 新的参数结构：使用不同的key来区分不同的操作类型
interface WanToolParameters extends BaseToolParameters {
  t2i?: T2iParameters;
  i2v?: I2vParameters;
  t2v?: T2vParameters;
  kf2v?: Kf2vParameters;
}

/**
 * 万相AI工具 - 支持文生图、图生视频、文生视频、关键帧生视频等功能
 *
 * 注意：此工具需要配置阿里云百炼API的访问密钥才能正常工作
 * 环境变量：
 * - DASHSCOPE_API_KEY
 *
 * 特性：
 * - 异步接口自动包装成同步接口
 * - 内部实现智能轮询
 * - 支持超时和重试机制
 * - 自动保存结果到本地
 */
export class WanTool extends AbstractBaseTool<WanToolParameters> {
  public name = 'wan_aigc';
  public description =
    '万相AI工具，支持文生图、图生视频、文生视频、关键帧生视频等多种AI生成功能。异步任务会自动轮询直到完成，支持超时配置。结果会自动保存到本地。';

  private wanService: WanService;
  private fileSystemTool: FileSystemTool;

  constructor() {
    super();
    this.wanService = new WanService();
    this.fileSystemTool = new FileSystemTool();
  }

  async execute(params: WanToolParameters): Promise<ToolResult> {
    try {
      // 检查环境变量配置
      if (!process.env.ALIYUN_DASHSCOPE_API_KEY) {
        return {
          content: [
            {
              type: 'text',
              text: '错误：万相AI工具未配置。请设置环境变量 ALIYUN_DASHSCOPE_API_KEY',
            },
          ],
          isError: true,
        };
      }

      // 检查参数结构，确定操作类型
      if (params.t2i) {
        return await this.executeT2iWithPolling(params.t2i);
      } else if (params.i2v) {
        return await this.executeI2vWithPolling(params.i2v);
      } else if (params.t2v) {
        return await this.executeT2vWithPolling(params.t2v);
      } else if (params.kf2v) {
        return await this.executeKf2vWithPolling(params.kf2v);
      } else {
        return {
          content: [{ type: 'text', text: '错误：请指定一个操作类型，例如 t2i, i2v, t2v, kf2v' }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `万相AI工具执行失败: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * 通用轮询函数
   */
  private async pollUntilComplete<T>(
    submitFn: () => Promise<{ task_id: string }>,
    getResultFn: (taskId: string) => Promise<T>,
    checkStatusFn: (result: T) => 'pending' | 'done' | 'error',
    maxWaitTime: number = 300,
    pollInterval: number = 5,
  ): Promise<T> {
    try {
      // 提交任务
      const submitResult = await submitFn();
      const taskId = submitResult.task_id;

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
      const outputDir = saveDirectory || `./wan_output/${operationType}/${timestamp}_${sanitizedPrompt}`;
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

  private async executeT2iWithPolling(params: T2iParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 300;
    const pollInterval = params.poll_interval || 5;

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.wanService.t2iSubmit({
          model: params.model,
          input: {
            prompt: params.prompt,
            negative_prompt: params.negative_prompt,
          },
          parameters: {
            size: (params.size || '1024*1024') as any,
            n: params.n || 4,
            seed: params.seed,
            prompt_extend: params.prompt_extend ?? true,
            watermark: params.watermark ?? false,
          },
        });
        if (response.code) {
          throw new Error(`万相文生图生成失败: ${response.message}`);
        }
        return { task_id: response.output.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.wanService.t2iGetResult({
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        // 如果任务完成，自动保存图片
        if (response.output.task_status === 'SUCCEEDED' && response.output.results) {
          for (let i = 0; i < response.output.results.length; i++) {
            const imageUrl = response.output.results[i]?.url;
            if (imageUrl) {
              const result = await this.downloadAndSaveFromUrl(imageUrl, 't2i', params.prompt, 'png', params.save_directory, params.custom_filename);
              savedFiles.push(...result.savedFiles);
            }
          }
        }

        return {
          status: response.output.task_status,
          results: response.output.results,
          saved_files: savedFiles,
          usage: response.usage,
        };
      },
      result => {
        if (result.status === 'SUCCEEDED') {
          return 'done';
        } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
          return 'pending';
        } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
          return 'error';
        } else {
          return 'pending';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `万相文生图生成成功！` },
          { type: 'text', text: `模型: ${params.model}` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          { type: 'text', text: `生成了 ${result.results?.length || 0} 张图片` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeI2vWithPolling(params: I2vParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.wanService.i2vSubmit({
          model: params.model,
          input: {
            prompt: params.prompt,
            negative_prompt: params.negative_prompt,
            image_url: params.image_url,
          },
          parameters: {
            resolution: params.resolution,
            duration: params.duration,
            prompt_extend: params.prompt_extend ?? true,
            seed: params.seed,
            watermark: params.watermark ?? false,
          },
        });
        if (response.code) {
          throw new Error(`万相图生视频任务提交失败: ${response.message}`);
        }
        return { task_id: response.output.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.wanService.i2vGetResult({
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        let message = '';
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.output.task_status === 'SUCCEEDED' && response.output.video_url) {
          try {
            const result = await this.downloadAndSaveFromUrl(
              response.output.video_url,
              'i2v',
              params.prompt || '图生视频',
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
          status: response.output.task_status,
          video_url: response.output.video_url,
          saved_files: savedFiles,
          message: message,
          usage: response.usage,
        };
      },
      result => {
        if (result.status === 'SUCCEEDED') {
          return 'done';
        } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
          return 'pending';
        } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
          return 'error';
        } else {
          return 'pending';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `万相图生视频生成成功！` },
          { type: 'text', text: `模型: ${params.model}` },
          { type: 'text', text: `提示词: ${params.prompt || '图生视频'}` },
          { type: 'text', text: `视频URL: ${result.video_url}` },
          { type: 'text', text: result.message },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeT2vWithPolling(params: T2vParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.wanService.t2vSubmit({
          model: params.model,
          input: {
            prompt: params.prompt,
            negative_prompt: params.negative_prompt,
          },
          parameters: {
            size: params.size,
            duration: params.duration,
            prompt_extend: params.prompt_extend ?? true,
            seed: params.seed,
            watermark: params.watermark ?? false,
          },
        });
        if (response.code) {
          throw new Error(`万相文生视频任务提交失败: ${response.message}`);
        }
        return { task_id: response.output.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.wanService.t2vGetResult({
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        let message = '';
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.output.task_status === 'SUCCEEDED' && response.output.video_url) {
          try {
            const result = await this.downloadAndSaveFromUrl(
              response.output.video_url,
              't2v',
              params.prompt || '文生视频',
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
          status: response.output.task_status,
          video_url: response.output.video_url,
          saved_files: savedFiles,
          message: message,
          usage: response.usage,
        };
      },
      result => {
        if (result.status === 'SUCCEEDED') {
          return 'done';
        } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
          return 'pending';
        } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
          return 'error';
        } else {
          return 'pending';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `万相文生视频生成成功！` },
          { type: 'text', text: `模型: ${params.model}` },
          { type: 'text', text: `提示词: ${params.prompt || '文生视频'}` },
          { type: 'text', text: `视频URL: ${result.video_url}` },
          { type: 'text', text: result.message },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeKf2vWithPolling(params: Kf2vParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.wanService.kf2vSubmit({
          model: params.model,
          input: {
            prompt: params.prompt,
            negative_prompt: params.negative_prompt,
            first_frame_url: params.first_frame_url,
            last_frame_url: params.last_frame_url,
          },
          parameters: {
            resolution: params.resolution,
            duration: params.duration,
            prompt_extend: params.prompt_extend ?? true,
            seed: params.seed,
            watermark: params.watermark ?? false,
          },
        });
        if (response.code) {
          throw new Error(`万相关键帧生视频任务提交失败: ${response.message}`);
        }
        return { task_id: response.output.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.wanService.kf2vGetResult({
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        let message = '';
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.output.task_status === 'SUCCEEDED' && response.output.video_url) {
          try {
            const result = await this.downloadAndSaveFromUrl(
              response.output.video_url,
              'kf2v',
              params.prompt || '关键帧生视频',
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
          status: response.output.task_status,
          video_url: response.output.video_url,
          saved_files: savedFiles,
          message: message,
          usage: response.usage,
        };
      },
      result => {
        if (result.status === 'SUCCEEDED') {
          return 'done';
        } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
          return 'pending';
        } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
          return 'error';
        } else {
          return 'pending';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `万相关键帧生视频生成成功！` },
          { type: 'text', text: `模型: ${params.model}` },
          { type: 'text', text: `提示词: ${params.prompt || '关键帧生视频'}` },
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
      description: '万相AI工具参数',
      properties: {
        t2i: {
          type: 'object',
          description: '万相文生图参数（内部轮询）',
          properties: {
            model: {
              type: 'string',
              enum: ['wan2.2-t2i-flash', 'wan2.2-t2i-plus', 'wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus', 'wanx2.0-t2i-turbo'],
              description: '使用的模型',
            },
            prompt: { type: 'string', description: '提示词描述' },
            negative_prompt: { type: 'string', description: '负向提示词' },
            size: { type: 'string', description: '图片尺寸，格式为宽*高，如1024*1024', default: '1024*1024' },
            n: { type: 'number', minimum: 1, maximum: 4, description: '生成图片数量', default: 4 },
            seed: { type: 'number', minimum: 0, maximum: 2147483647, description: '随机种子' },
            prompt_extend: { type: 'boolean', description: '是否扩展提示词', default: true },
            watermark: { type: 'boolean', description: '是否添加水印', default: false },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 300 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 5 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['model', 'prompt'],
        },
        i2v: {
          type: 'object',
          description: '万相图生视频参数（内部轮询）',
          properties: {
            model: {
              type: 'string',
              enum: ['wan2.2-i2v-flash', 'wan2.2-i2v-plus', 'wanx2.1-i2v-plus', 'wanx2.1-i2v-turbo'],
              description: '使用的模型',
            },
            prompt: { type: 'string', description: '提示词描述' },
            negative_prompt: { type: 'string', description: '负向提示词' },
            image_url: { type: 'string', description: '输入图片URL' },
            resolution: { type: 'string', enum: ['480P', '720P', '1080P'], description: '视频分辨率' },
            duration: { type: 'number', minimum: 3, maximum: 5, description: '视频时长（秒）', default: 5 },
            prompt_extend: { type: 'boolean', description: '是否扩展提示词', default: true },
            seed: { type: 'number', minimum: 0, maximum: 2147483647, description: '随机种子' },
            watermark: { type: 'boolean', description: '是否添加水印', default: false },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['model', 'image_url'],
        },
        t2v: {
          type: 'object',
          description: '万相文生视频参数（内部轮询）',
          properties: {
            model: {
              type: 'string',
              enum: ['wan2.2-t2v-plus', 'wanx2.1-t2v-turbo', 'wanx2.1-t2v-plus'],
              description: '使用的模型',
            },
            prompt: { type: 'string', description: '提示词描述' },
            negative_prompt: { type: 'string', description: '负向提示词' },
            size: { type: 'string', description: '视频尺寸，格式为宽*高，如1920*1080' },
            duration: { type: 'number', minimum: 3, maximum: 5, description: '视频时长（秒）', default: 5 },
            prompt_extend: { type: 'boolean', description: '是否扩展提示词', default: true },
            seed: { type: 'number', minimum: 0, maximum: 2147483647, description: '随机种子' },
            watermark: { type: 'boolean', description: '是否添加水印', default: false },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['model'],
        },
        kf2v: {
          type: 'object',
          description: '万相关键帧生视频参数（内部轮询）',
          properties: {
            model: {
              type: 'string',
              enum: ['wanx2.1-kf2v-plus'],
              description: '使用的模型',
            },
            prompt: { type: 'string', description: '提示词描述' },
            negative_prompt: { type: 'string', description: '负向提示词' },
            first_frame_url: { type: 'string', description: '首帧图片URL' },
            last_frame_url: { type: 'string', description: '尾帧图片URL' },
            resolution: { type: 'string', enum: ['720P'], description: '视频分辨率', default: '720P' },
            duration: { type: 'number', minimum: 5, maximum: 5, description: '视频时长（秒）', default: 5 },
            prompt_extend: { type: 'boolean', description: '是否扩展提示词', default: true },
            seed: { type: 'number', minimum: 0, maximum: 2147483647, description: '随机种子' },
            watermark: { type: 'boolean', description: '是否添加水印', default: false },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['model', 'first_frame_url', 'last_frame_url'],
        },
      },
      // 确保至少有一个操作类型被指定
      anyOf: [{ required: ['t2i'] }, { required: ['i2v'] }, { required: ['t2v'] }, { required: ['kf2v'] }],
    };
  }
}
