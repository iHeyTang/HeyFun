import { JimengService } from '../../aigc/services/jimeng';
import { BaseToolParameters, ToolResult } from '../types';
import { AbstractBaseTool } from './base';
import { FileSystemTool } from './file-system';
import * as path from 'path';
import * as fs from 'fs/promises';

// 为每个操作定义独立的参数接口
interface T2iV21Parameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  use_pre_llm?: boolean;
  use_sr?: boolean;
  return_url?: boolean;
  logo_info?: {
    add_logo?: boolean;
    position?: number;
    language?: number;
    opacity?: number;
    logo_text_content?: string;
  };
  save_directory?: string;
  custom_filename?: string;
}

interface T2iV30Parameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  use_pre_llm?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface T2iV31Parameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  use_pre_llm?: boolean;
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface I2iV30Parameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  scale?: number;
  binary_data_base64?: string[];
  image_url?: string[];
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface T2vS20ProParameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  aspect_ratio?: '16:9' | '9:16' | '4:3' | '3:4' | '21:9';
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

interface I2vS20ProParameters extends BaseToolParameters {
  prompt: string;
  seed?: number;
  aspect_ratio?: '16:9' | '9:16' | '4:3' | '3:4' | '21:9';
  binary_data_base64?: string[];
  image_url?: string[];
  max_wait_time?: number;
  poll_interval?: number;
  save_directory?: string;
  custom_filename?: string;
}

// 新的参数结构：使用不同的key来区分不同的操作类型
interface JimengToolParameters extends BaseToolParameters {
  t2i_v21?: T2iV21Parameters;
  t2i_v30?: T2iV30Parameters;
  t2i_v31?: T2iV31Parameters;
  i2i_v30?: I2iV30Parameters;
  t2v_s20_pro?: T2vS20ProParameters;
  i2v_s20_pro?: I2vS20ProParameters;
}

/**
 * 即梦AI工具 - 支持文生图、图生图、文生视频、图生视频等功能
 *
 * 注意：此工具需要配置即梦API的访问密钥才能正常工作
 * 环境变量：
 * - VOLCENGINE_JIMENG_ACCESS_KEY_ID
 * - VOLCENGINE_JIMENG_SECRET_ACCESS_KEY
 *
 * 特性：
 * - 异步接口自动包装成同步接口
 * - 内部实现智能轮询
 * - 支持超时和重试机制
 * - 自动保存二进制结果到本地
 */
export class JimengTool extends AbstractBaseTool<JimengToolParameters> {
  public name = 'jimeng_aigc';
  public description =
    '即梦AI工具，支持文生图、图生图、文生视频、图生视频等多种AI生成功能。异步任务会自动轮询直到完成，支持超时配置。当结果是二进制数据时会自动保存到本地。';

  private jimengService: JimengService;
  private fileSystemTool: FileSystemTool;

  constructor() {
    super();
    this.jimengService = new JimengService();
    this.fileSystemTool = new FileSystemTool();
  }

  async execute(params: JimengToolParameters): Promise<ToolResult> {
    try {
      // 检查环境变量配置
      if (!process.env.VOLCENGINE_JIMENG_ACCESS_KEY_ID || !process.env.VOLCENGINE_JIMENG_SECRET_ACCESS_KEY) {
        return {
          content: [
            {
              type: 'text',
              text: '错误：即梦AI工具未配置。请设置环境变量 VOLCENGINE_JIMENG_ACCESS_KEY_ID 和 VOLCENGINE_JIMENG_SECRET_ACCESS_KEY',
            },
          ],
          isError: true,
        };
      }

      // 检查参数结构，确定操作类型
      if (params.t2i_v21) {
        return await this.executeT2iV21(params.t2i_v21);
      } else if (params.t2i_v30) {
        return await this.executeT2iV30WithPolling(params.t2i_v30);
      } else if (params.t2i_v31) {
        return await this.executeT2iV31WithPolling(params.t2i_v31);
      } else if (params.i2i_v30) {
        return await this.executeI2iV30WithPolling(params.i2i_v30);
      } else if (params.t2v_s20_pro) {
        return await this.executeT2vS20ProWithPolling(params.t2v_s20_pro);
      } else if (params.i2v_s20_pro) {
        return await this.executeI2vS20ProWithPolling(params.i2v_s20_pro);
      } else {
        return {
          content: [{ type: 'text', text: '错误：请指定一个操作类型，例如 t2i_v21, t2i_v30, i2i_v30, t2v_s20_pro, i2v_s20_pro' }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `即梦AI工具执行失败: ${errorMessage}` }],
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
   * 自动保存二进制数据到本地
   */
  private async saveBase64ToLocal(
    binaryDataBase64: string[],
    operationType: string,
    prompt: string,
    fileExtension: string = 'png',
    saveDirectory?: string,
    customFilename?: string,
  ): Promise<{ savedFiles: string[]; message: string }> {
    try {
      const savedFiles: string[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedPrompt = prompt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);

      // 创建输出目录
      const outputDir = saveDirectory || `./jimeng_output/${operationType}/${timestamp}_${sanitizedPrompt}`;

      for (let i = 0; i < binaryDataBase64.length; i++) {
        const fileName = customFilename ? `${customFilename}_${i + 1}.${fileExtension}` : `output_${i + 1}.${fileExtension}`;
        const filePath = path.join(outputDir, fileName);

        // 使用文件系统工具保存二进制数据
        const result = await this.fileSystemTool.execute({
          operation: 'write_binary',
          path: filePath,
          binary_data: binaryDataBase64[i],
        });

        if (!result.isError) {
          savedFiles.push(filePath);
        } else {
          console.warn(`保存文件失败: ${filePath}`, result.error);
        }
      }

      const message =
        savedFiles.length > 0
          ? `\n✅ 已自动保存 ${savedFiles.length} 个文件到本地:\n${savedFiles.map(file => `  - ${file}`).join('\n')}`
          : '\n⚠️ 二进制数据保存失败';

      return { savedFiles, message };
    } catch (error) {
      console.error('保存二进制数据失败:', error);
      return { savedFiles: [], message: '\n⚠️ 保存二进制数据时发生错误' };
    }
  }

  /**
   * 从URL下载文件并保存到本地
   */
  private async downloadAndSaveFromUrl(
    url: string,
    operationType: string,
    prompt: string,
    fileExtension: string = 'mp4',
    saveDirectory?: string,
    customFilename?: string,
  ): Promise<{ savedFiles: string[]; message: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedPrompt = prompt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);

      // 创建输出目录
      const outputDir = saveDirectory || `./jimeng_output/${operationType}/${timestamp}_${sanitizedPrompt}`;
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

  /**
   * 创建图片内容数组
   */
  private createImageContent(binaryDataBase64: string[], operationType: string, fileExtension: string = 'png'): any[] {
    return binaryDataBase64.map((base64Data: string, index: number) => ({
      type: 'image',
      data: `data:image/${fileExtension === 'mp4' ? 'mp4' : 'png'};base64,${base64Data}`,
      alt_text: `${operationType} 生成的 ${fileExtension === 'mp4' ? '视频' : '图片'} ${index + 1}`,
    }));
  }

  private async executeT2iV21(params: T2iV21Parameters): Promise<ToolResult> {
    try {
      // 调用真实的即梦API
      const response = await this.jimengService.t2iV21({
        req_key: 'jimeng_high_aes_general_v21_L',
        prompt: params.prompt,
        seed: params.seed || -1,
        width: params.width || 512,
        height: params.height || 512,
        use_pre_llm: params.use_pre_llm ?? true,
        use_sr: params.use_sr ?? true,
        return_url: params.return_url ?? true,
        logo_info: {
          add_logo: params.logo_info?.add_logo ?? false,
          position: params.logo_info?.position ?? 0,
          language: params.logo_info?.language ?? 0,
          opacity: params.logo_info?.opacity ?? 0.3,
          logo_text_content: params.logo_info?.logo_text_content ?? '',
        },
      });

      if (response.status === 10000 && response.data.algorithm_base_resp.status_code === 10000) {
        // 处理响应，自动保存二进制数据
        const { savedFiles, message } = await this.saveBase64ToLocal(
          response.data.binary_data_base64,
          't2i_v21',
          params.prompt,
          'png',
          params.save_directory,
          params.custom_filename,
        );

        return {
          content: [
            { type: 'text', text: `文生图2.1生成成功！` },
            { type: 'text', text: `提示词: ${params.prompt}` },
            ...savedFiles.map(file => {
              return { type: 'image' as const, data: file, mimeType: '' };
            }),
          ],
        };
      } else {
        return {
          content: [{ type: 'text', text: `Failed: ${response.message || 'Unknown error'}` }],
          isError: true,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Failed: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async executeT2iV30WithPolling(params: T2iV30Parameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 300;
    const pollInterval = params.poll_interval || 5;

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.jimengService.t2iV30Submit({
          req_key: 'jimeng_t2i_v30',
          prompt: params.prompt,
          seed: params.seed || -1,
          width: params.width || 1328,
          height: params.height || 1328,
          use_pre_llm: params.use_pre_llm ?? true,
        });
        return { task_id: response.data.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.jimengService.t2iV30GetResult({
          req_key: 'jimeng_t2i_v30',
          task_id: taskId,
          req_json: {
            logo_info: {
              add_logo: false,
              position: 0,
              language: 0,
              opacity: 0.3,
              logo_text_content: '',
            },
            return_url: true,
          },
        });

        let savedFiles: string[] = [];
        let imageContent: any[] = [];
        // 如果任务完成，自动保存二进制数据
        if (response.data.status === 'done' && response.data.binary_data_base64) {
          const result = await this.saveBase64ToLocal(
            response.data.binary_data_base64,
            't2i_v30',
            params.prompt,
            'png',
            params.save_directory,
            params.custom_filename,
          );
          savedFiles = result.savedFiles;
          imageContent = this.createImageContent(response.data.binary_data_base64, 't2i_v30', 'png');
        }

        return {
          status: response.data.status,
          image_urls: response.data.image_urls,
          binary_data_base64: response.data.binary_data_base64,
          saved_files: savedFiles,
          image_content: imageContent,
        };
      },
      result => {
        if (result.status === 'done') {
          return 'done';
        } else if (result.status === 'in_queue' || result.status === 'generating') {
          return 'pending';
        } else {
          return 'error';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `文生图3.0生成成功！` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeT2iV31WithPolling(params: T2iV31Parameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 300;
    const pollInterval = params.poll_interval || 5;

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.jimengService.t2iV31Submit({
          req_key: 'jimeng_t2i_v31',
          prompt: params.prompt,
          seed: params.seed || -1,
          width: params.width || 1328,
          height: params.height || 1328,
          use_pre_llm: params.use_pre_llm ?? true,
        });
        return { task_id: response.data.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.jimengService.t2iV31GetResult({
          req_key: 'jimeng_t2i_v31',
          task_id: taskId,
          req_json: {
            logo_info: {
              add_logo: false,
              position: 0,
              language: 0,
              opacity: 0.3,
              logo_text_content: '',
            },
            return_url: true,
          },
        });

        let savedFiles: string[] = [];
        let imageContent: any[] = [];
        // 如果任务完成，自动保存二进制数据
        if (response.data.status === 'done' && response.data.binary_data_base64) {
          const result = await this.saveBase64ToLocal(
            response.data.binary_data_base64,
            't2i_v31',
            params.prompt,
            'png',
            params.save_directory,
            params.custom_filename,
          );
          savedFiles = result.savedFiles;
          imageContent = this.createImageContent(response.data.binary_data_base64, 't2i_v31', 'png');
        }

        return {
          status: response.data.status,
          image_urls: response.data.image_urls,
          binary_data_base64: response.data.binary_data_base64,
          saved_files: savedFiles,
          image_content: imageContent,
        };
      },
      result => {
        if (result.status === 'done') {
          return 'done';
        } else if (result.status === 'in_queue' || result.status === 'generating') {
          return 'pending';
        } else {
          return 'error';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `文生图3.1生成成功！` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeI2iV30WithPolling(params: I2iV30Parameters): Promise<ToolResult> {
    if (!params.binary_data_base64 && !params.image_url) {
      return {
        content: [{ type: 'text', text: '错误：图生图需要提供 binary_data_base64 或 image_url 参数' }],
        isError: true,
      };
    }

    const maxWaitTime = params.max_wait_time || 300;
    const pollInterval = params.poll_interval || 5;

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.jimengService.i2iV30Submit({
          req_key: 'jimeng_i2i_v30',
          prompt: params.prompt,
          seed: params.seed || -1,
          width: params.width || 1328,
          height: params.height || 1328,
          scale: params.scale || 0.5,
          binary_data_base64: params.binary_data_base64,
          image_url: params.image_url,
        });
        return { task_id: response.data.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.jimengService.i2iV30GetResult({
          req_key: 'jimeng_i2i_v30',
          task_id: taskId,
          req_json: {
            logo_info: {
              add_logo: false,
              position: 0,
              language: 0,
              opacity: 0.3,
              logo_text_content: '',
            },
            return_url: true,
          },
        });

        let savedFiles: string[] = [];
        let imageContent: any[] = [];
        // 如果任务完成，自动保存二进制数据
        if (response.data.status === 'done' && response.data.binary_data_base64) {
          const result = await this.saveBase64ToLocal(
            response.data.binary_data_base64,
            'i2i_v30',
            params.prompt,
            'png',
            params.save_directory,
            params.custom_filename,
          );
          savedFiles = result.savedFiles;
          imageContent = this.createImageContent(response.data.binary_data_base64, 'i2i_v30', 'png');
        }

        return {
          status: response.data.status,
          image_urls: response.data.image_urls,
          binary_data_base64: response.data.binary_data_base64,
          saved_files: savedFiles,
          image_content: imageContent,
        };
      },
      result => {
        if (result.status === 'done') {
          return 'done';
        } else if (result.status === 'in_queue' || result.status === 'generating') {
          return 'pending';
        } else {
          return 'error';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `图生图3.0生成成功！` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeT2vS20ProWithPolling(params: T2vS20ProParameters): Promise<ToolResult> {
    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.jimengService.t2vS20Pro({
          req_key: 'jimeng_vgfm_t2v_l20',
          prompt: params.prompt,
          seed: params.seed || -1,
          aspect_ratio: params.aspect_ratio || '16:9',
        });
        return { task_id: response.data.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.jimengService.t2vS20ProGetResult({
          req_key: 'jimeng_vgfm_t2v_l20',
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        let imageContent: any[] = [];
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.data.status === 10000 && response.data.video_url) {
          try {
            const result = await this.downloadAndSaveFromUrl(
              response.data.video_url,
              't2v_s20_pro',
              params.prompt,
              'mp4',
              params.save_directory,
              params.custom_filename,
            );
            savedFiles = result.savedFiles;
            // 为视频创建特殊的content，包含下载链接
            imageContent = [
              {
                type: 'text',
                text: `视频生成完成！\n视频URL: ${response.data.video_url}\n${result.message}`,
              },
            ];
          } catch (error) {
            console.warn('下载视频失败:', error);
            imageContent = [
              {
                type: 'text',
                text: `视频生成完成！\n视频URL: ${response.data.video_url}\n⚠️ 下载视频失败: ${error instanceof Error ? error.message : '未知错误'}`,
              },
            ];
          }
        }

        return {
          status: response.data.status === 10000 ? 'done' : 'generating',
          video_url: response.data.video_url,
          saved_files: savedFiles,
          image_content: imageContent,
        };
      },
      result => {
        if (result.status === 'done') {
          return 'done';
        } else if (result.status === 'in_queue' || result.status === 'generating') {
          return 'pending';
        } else {
          return 'error';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `文生视频S2.0Pro生成成功！` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  private async executeI2vS20ProWithPolling(params: I2vS20ProParameters): Promise<ToolResult> {
    if (!params.binary_data_base64 && !params.image_url) {
      return {
        content: [{ type: 'text', text: '错误：图生视频需要提供 binary_data_base64 或 image_url 参数' }],
        isError: true,
      };
    }

    const maxWaitTime = params.max_wait_time || 600; // 视频生成可能需要更长时间
    const pollInterval = params.poll_interval || 10; // 视频生成轮询间隔可以更长

    return await this.pollUntilComplete(
      // 提交任务函数
      async () => {
        const response = await this.jimengService.i2vS20Pro({
          req_key: 'jimeng_vgfm_i2v_l20',
          prompt: params.prompt,
          seed: params.seed || -1,
          aspect_ratio: params.aspect_ratio || '16:9',
          binary_data_base64: params.binary_data_base64,
          image_urls: params.image_url,
        });
        return { task_id: response.data.task_id };
      },
      // 获取结果函数
      async (taskId: string) => {
        const response = await this.jimengService.i2vS20ProGetResult({
          req_key: 'jimeng_vgfm_i2v_l20',
          task_id: taskId,
        });

        let savedFiles: string[] = [];
        let imageContent: any[] = [];
        // 如果任务完成，尝试下载视频并保存到本地
        if (response.data.status === 10000 && response.data.video_url) {
          try {
            const result = await this.downloadAndSaveFromUrl(
              response.data.video_url,
              'i2v_s20_pro',
              params.prompt,
              'mp4',
              params.save_directory,
              params.custom_filename,
            );
            savedFiles = result.savedFiles;
            // 为视频创建特殊的content，包含下载链接
            imageContent = [
              {
                type: 'text',
                text: `视频生成完成！\n视频URL: ${response.data.video_url}\n${result.message}`,
              },
            ];
          } catch (error) {
            console.warn('下载视频失败:', error);
            imageContent = [
              {
                type: 'text',
                text: `视频生成完成！\n视频URL: ${response.data.video_url}\n⚠️ 下载视频失败: ${error instanceof Error ? error.message : '未知错误'}`,
              },
            ];
          }
        }

        return {
          status: response.data.status === 10000 ? 'done' : 'generating',
          video_url: response.data.video_url,
          saved_files: savedFiles,
          image_content: imageContent,
        };
      },
      result => {
        if (result.status === 'done') {
          return 'done';
        } else if (result.status === 'in_queue' || result.status === 'generating') {
          return 'pending';
        } else {
          return 'error';
        }
      },
      maxWaitTime,
      pollInterval,
    ).then(result => {
      return {
        content: [
          { type: 'text', text: `图生视频S2.0Pro生成成功！` },
          { type: 'text', text: `提示词: ${params.prompt}` },
          ...result.saved_files.map(file => ({ type: 'image' as const, data: file, mimeType: '' })),
        ],
      };
    });
  }

  protected getParametersSchema(): any {
    return {
      type: 'object',
      description: '即梦AI工具参数',
      properties: {
        t2i_v21: {
          type: 'object',
          description: '文生图2.1参数（同步）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            width: { type: 'number', description: '图片宽度', minimum: 256, maximum: 768, default: 512 },
            height: { type: 'number', description: '图片高度', minimum: 256, maximum: 768, default: 512 },
            use_pre_llm: { type: 'boolean', description: '是否使用预LLM处理', default: true },
            use_sr: { type: 'boolean', description: '是否使用超分辨率', default: true },
            return_url: { type: 'boolean', description: '是否返回URL', default: true },
            logo_info: {
              type: 'object',
              description: 'Logo信息配置',
              properties: {
                add_logo: { type: 'boolean', default: false },
                position: { type: 'number', default: 0 },
                language: { type: 'number', default: 0 },
                opacity: { type: 'number', default: 0.3 },
                logo_text_content: { type: 'string', default: '' },
              },
            },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
        },
        t2i_v30: {
          type: 'object',
          description: '文生图3.0参数（内部轮询）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            width: { type: 'number', description: '图片宽度', minimum: 512, maximum: 2048, default: 1328 },
            height: { type: 'number', description: '图片高度', minimum: 512, maximum: 2048, default: 1328 },
            use_pre_llm: { type: 'boolean', description: '是否使用预LLM处理', default: true },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 300 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 5 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
        },
        t2i_v31: {
          type: 'object',
          description: '文生图3.1参数（内部轮询）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            width: { type: 'number', description: '图片宽度', minimum: 512, maximum: 2048, default: 1328 },
            height: { type: 'number', description: '图片高度', minimum: 512, maximum: 2048, default: 1328 },
            use_pre_llm: { type: 'boolean', description: '是否使用预LLM处理', default: true },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 300 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 5 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
        },
        i2i_v30: {
          type: 'object',
          description: '图生图3.0参数（内部轮询）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            width: { type: 'number', description: '图片宽度', minimum: 512, maximum: 2048, default: 1328 },
            height: { type: 'number', description: '图片高度', minimum: 512, maximum: 2048, default: 1328 },
            scale: { type: 'number', minimum: 0, maximum: 1, description: '图生图强度', default: 0.5 },
            binary_data_base64: { type: 'array', items: { type: 'string' }, description: 'Base64编码的图片数据' },
            image_url: { type: 'array', items: { type: 'string' }, description: '图片URL数组' },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 300 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 5 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
          anyOf: [{ required: ['binary_data_base64'] }, { required: ['image_url'] }],
        },
        t2v_s20_pro: {
          type: 'object',
          description: '文生视频S2.0Pro参数（内部轮询）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '4:3', '3:4', '21:9'], description: '视频宽高比', default: '16:9' },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
        },
        i2v_s20_pro: {
          type: 'object',
          description: '图生视频S2.0Pro参数（内部轮询）',
          properties: {
            prompt: { type: 'string', description: '提示词描述' },
            seed: { type: 'number', description: '随机种子，-1表示随机', default: -1 },
            aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '4:3', '3:4', '21:9'], description: '视频宽高比', default: '16:9' },
            binary_data_base64: { type: 'array', items: { type: 'string' }, description: 'Base64编码的图片数据' },
            image_url: { type: 'array', items: { type: 'string' }, description: '图片URL数组' },
            max_wait_time: { type: 'number', description: '最大等待时间（秒）', default: 600 },
            poll_interval: { type: 'number', description: '轮询间隔（秒）', default: 10 },
            save_directory: { type: 'string', description: '保存目录路径，如果不指定则使用默认目录' },
            custom_filename: { type: 'string', description: '自定义文件名（不包含扩展名），如果不指定则使用默认文件名' },
          },
          required: ['prompt'],
          anyOf: [{ required: ['binary_data_base64'] }, { required: ['image_url'] }],
        },
      },
      // 确保至少有一个操作类型被指定
      anyOf: [
        { required: ['t2i_v21'] },
        { required: ['t2i_v30'] },
        { required: ['t2i_v31'] },
        { required: ['i2i_v30'] },
        { required: ['t2v_s20_pro'] },
        { required: ['i2v_s20_pro'] },
      ],
    };
  }
}
