'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { AdapterManager } from '@repo/llm/aigc';
import type { GenerationType } from '@repo/llm/aigc';
import z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { prisma } from '@/lib/server/prisma';
import sandboxManager from '@/lib/server/sandbox';
import { nanoid } from 'nanoid';
import { join } from 'path';

// 任务状态枚举
export enum PaintboardTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 结果项类型
export interface PaintboardResult {
  id: string;
  url: string;
  localPath: string;
  filename: string;
  size: number;
  fileType: string;
  createdAt: string;
}

// 根据生成类型获取对应的模型
export const getModelsByGenerationType = withUserAuth(async ({ args }: AuthWrapperContext<{ generationType: GenerationType }>) => {
  const { generationType } = args;
  const manager = AdapterManager.getInstance();
  const models = await manager.getModelsByGenerationType(generationType);
  return models;
});

// 获取所有服务模型信息
export const getAllServiceModels = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  const manager = AdapterManager.getInstance();
  const models = await manager.getAllServiceModels();
  return models;
});

// 获取模型的schema和字段信息
export const getModelSchema = withUserAuth(
  async ({ args }: AuthWrapperContext<{ service: string; model: string; generationType: GenerationType }>) => {
    const { service, model, generationType } = args;

    try {
      let schema: z.ZodTypeAny | null = null;

      switch (service) {
        case 'wan': {
          const { wanT2iSubmitParamsSchema, wanI2vSubmitParamsSchema, wanKf2vSubmitParamsSchema, wanT2vSubmitParamsSchema } = await import(
            '@repo/llm/aigc'
          );

          switch (generationType) {
            case 'text-to-image':
              schema = wanT2iSubmitParamsSchema;
              break;
            case 'image-to-video':
              schema = wanI2vSubmitParamsSchema;
              break;
            case 'keyframe-to-video':
              schema = wanKf2vSubmitParamsSchema;
              break;
            case 'text-to-video':
              schema = wanT2vSubmitParamsSchema;
              break;
          }
          break;
        }

        case 'doubao': {
          const {
            doubaoT2iSubmitParamsSchema,
            doubaoI2iSubmitParamsSchema,
            doubaoT2vSubmitParamsSchema,
            doubaoI2vSubmitParamsSchema,
            doubaoKf2vSubmitParamsSchema,
          } = await import('@repo/llm/aigc');

          switch (generationType) {
            case 'text-to-image':
              schema = doubaoT2iSubmitParamsSchema;
              break;
            case 'image-to-image':
              schema = doubaoI2iSubmitParamsSchema;
              break;
            case 'text-to-video':
              schema = doubaoT2vSubmitParamsSchema;
              break;
            case 'image-to-video':
              schema = doubaoI2vSubmitParamsSchema;
              break;
            case 'keyframe-to-video':
              schema = doubaoKf2vSubmitParamsSchema;
              break;
          }
          break;
        }

        case 'jimeng': {
          const { jimengT2iSubmitParamsSchema, jimengI2iSubmitParamsSchema, jimengT2vSubmitParamsSchema, jimengI2vSubmitParamsSchema } = await import(
            '@repo/llm/aigc'
          );

          switch (generationType) {
            case 'text-to-image':
              // 所有文生图模型都使用统一的t2iSubmitParamsSchema
              schema = jimengT2iSubmitParamsSchema;
              break;
            case 'image-to-image':
              schema = jimengI2iSubmitParamsSchema;
              break;
            case 'text-to-video':
              schema = jimengT2vSubmitParamsSchema;
              break;
            case 'image-to-video':
              schema = jimengI2vSubmitParamsSchema;
              break;
          }
          break;
        }
      }

      if (schema) {
        try {
          // 将 Zod schema 转换为 JSON Schema，使用更简单的配置
          const jsonSchema = zodToJsonSchema(schema, {
            name: `${service}_${model}_schema`,
            $refStrategy: 'none',
          });

          const ref = (jsonSchema as { $ref: string }).$ref;
          const definitions = jsonSchema.definitions?.[ref.replace('#/definitions/', '')];

          return { schema: true, jsonSchema: definitions };
        } catch (error) {
          console.error('转换 Zod schema 到 JSON Schema 时出错:', error);
          return { schema: false, jsonSchema: null };
        }
      }

      return { schema: false, jsonSchema: null };
    } catch (error) {
      console.error('Error getting model schema:', error);
      return { schema: false, jsonSchema: null };
    }
  },
);

// 创建画板任务记录
export const createPaintboardTask = withUserAuth(
  async ({
    args,
    organization,
  }: AuthWrapperContext<{
    service: string;
    model: string;
    generationType: GenerationType;
    params: any;
  }>) => {
    const { service, model, generationType, params } = args;

    try {
      const task = await prisma.paintboardTasks.create({
        data: {
          organizationId: organization.id,
          service,
          model,
          generationType,
          params,
          status: PaintboardTaskStatus.PENDING,
        },
      });

      return task;
    } catch (error) {
      console.error('Error creating paintboard task:', error);
      throw new Error((error as Error).message);
    }
  },
);

// 更新任务状态
export const updatePaintboardTaskStatus = withUserAuth(
  async ({
    args,
  }: AuthWrapperContext<{
    taskId: string;
    status: PaintboardTaskStatus;
    externalTaskId?: string;
    error?: string;
  }>) => {
    const { taskId, status, externalTaskId, error } = args;

    try {
      const task = await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: {
          status,
          ...(externalTaskId && { taskId: externalTaskId }),
          ...(error && { error }),
        },
      });

      return task;
    } catch (error) {
      console.error('Error updating paintboard task status:', error);
      throw new Error((error as Error).message);
    }
  },
);

// 更新任务结果
export const updatePaintboardTaskResults = withUserAuth(
  async ({
    args,
  }: AuthWrapperContext<{
    taskId: string;
    results: any;
  }>) => {
    const { taskId, results } = args;

    try {
      const task = await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: {
          results,
          status: PaintboardTaskStatus.COMPLETED,
        },
      });

      return task;
    } catch (error) {
      console.error('Error updating paintboard task results:', error);
      throw new Error((error as Error).message);
    }
  },
);

// 获取用户的所有画板任务
export const getUserPaintboardTasks = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  try {
    const tasks = await prisma.paintboardTasks.findMany({
      where: {
        organizationId: organization.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
  } catch (error) {
    console.error('Error getting user paintboard tasks:', error);
    throw new Error((error as Error).message);
  }
});

// 获取特定任务
export const getPaintboardTask = withUserAuth(async ({ args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;

  try {
    const task = await prisma.paintboardTasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  } catch (error) {
    console.error('Error getting paintboard task:', error);
    throw new Error((error as Error).message);
  }
});

// 下载文件到sandbox并保存路径
async function downloadAndSaveToSandbox(url: string, filename: string, organizationId: string): Promise<{ localPath: string; size: number; fileType: string }> {
  try {
    // 获取或创建sandbox
    const sandboxes = await sandboxManager.list();
    let sandbox = sandboxes.find(s => s.id === organizationId);

    if (!sandbox) {
      sandbox = await sandboxManager.create({ user: organizationId });
      await sandboxManager.start(sandbox.id);
    }

    // 创建paintboard目录
    const paintboardDir = 'paintboard';
    try {
      await sandbox.fs.createFolder(paintboardDir, '755');
    } catch (error) {
      // 目录可能已存在，忽略错误
    }

    // 下载文件
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    // 识别文件类型
    const fileType = identifyFileType(buffer, filename);
    
    // 生成基于时间的文件名：时间戳_随机码.扩展名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // 格式：2024-01-15T10-30-45
    const randomCode = nanoid(8); // 8位随机码
    const extension = getFileExtension(fileType);
    const uniqueFilename = `${timestamp}_${randomCode}${extension}`;
    
    const filePath = join(paintboardDir, uniqueFilename);
    await sandbox.fs.uploadFileFromBuffer(buffer, filePath);

    return {
      localPath: filePath,
      size: buffer.length,
      fileType,
    };
  } catch (error) {
    console.error('Error downloading and saving file to sandbox:', error);
    throw error;
  }
}

// 识别文件类型
function identifyFileType(buffer: Buffer, originalFilename: string): string {
  // 检查文件魔数（文件头）来识别文件类型
  const header = buffer.slice(0, 16);
  
  // 图片格式
  if (header.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
    return 'image/jpeg';
  }
  if (header.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return 'image/png';
  }
  if (header.slice(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) || 
      header.slice(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) {
    return 'image/gif';
  }
  if (header.slice(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) && 
      header.slice(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) {
    return 'image/webp';
  }
  
  // 视频格式
  if (header.slice(0, 4).equals(Buffer.from([0x00, 0x00, 0x00, 0x18])) && 
      header.slice(4, 8).equals(Buffer.from([0x66, 0x74, 0x79, 0x70]))) {
    return 'video/mp4';
  }
  if (header.slice(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]))) {
    return 'video/webm';
  }
  if (header.slice(0, 3).equals(Buffer.from([0x00, 0x00, 0x01, 0xB3]))) {
    return 'video/mpeg';
  }
  
  // 音频格式
  if (header.slice(0, 3).equals(Buffer.from([0x49, 0x44, 0x33]))) {
    return 'audio/mpeg';
  }
  if (header.slice(0, 4).equals(Buffer.from([0x4F, 0x67, 0x67, 0x53]))) {
    return 'audio/ogg';
  }
  if (header.slice(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) && 
      header.slice(8, 12).equals(Buffer.from([0x57, 0x41, 0x56, 0x45]))) {
    return 'audio/wav';
  }
  
  // 如果无法通过魔数识别，尝试从原始文件名推断
  const lowerFilename = originalFilename.toLowerCase();
  if (lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerFilename.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerFilename.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lowerFilename.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lowerFilename.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (lowerFilename.endsWith('.webm')) {
    return 'video/webm';
  }
  if (lowerFilename.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lowerFilename.endsWith('.ogg')) {
    return 'audio/ogg';
  }
  if (lowerFilename.endsWith('.wav')) {
    return 'audio/wav';
  }
  
  // 默认返回通用二进制类型
  return 'application/octet-stream';
}

// 根据文件类型获取文件扩展名
function getFileExtension(fileType: string): string {
  switch (fileType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/mpeg':
      return '.mpeg';
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/wav':
      return '.wav';
    default:
      return '.bin';
  }
}

// 处理任务结果
export const processPaintboardTaskResult = withUserAuth(
  async ({
    args,
    organization,
  }: AuthWrapperContext<{
    taskId: string;
    service: string;
    model: string;
    generationType: GenerationType;
    externalTaskId: string;
    maxRetries?: number;
    retryDelay?: number;
  }>) => {
    const { taskId, service, model, generationType, externalTaskId, maxRetries = 30, retryDelay = 3000 } = args;

    try {
      // 更新任务状态为处理中
      await updatePaintboardTaskStatus({
        taskId,
        status: PaintboardTaskStatus.PROCESSING,
        externalTaskId,
      });

      // 轮询逻辑
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          console.log(`Polling task ${taskId}, attempt ${retryCount + 1}/${maxRetries}`);

          // 使用统一接口获取任务结果
          const manager = AdapterManager.getInstance();
          const result = await manager.getTaskResult(service, generationType, externalTaskId);
          console.log('result', result);

          // 检查任务是否完成
          if (result.status === 'completed' && result.data?.length) {
            const results: PaintboardResult[] = [];

            // 下载所有结果文件
            for (const item of result.data) {
              if (typeof item.url === 'string') {
                try {
                  const filename = item.url.split('/').pop() || 'generated_file';
                  const { localPath, size, fileType } = await downloadAndSaveToSandbox(item.url, filename, organization.id);

                  results.push({
                    id: nanoid(),
                    url: item.url,
                    localPath,
                    filename,
                    size,
                    fileType,
                    createdAt: new Date().toISOString(),
                  });
                } catch (error) {
                  console.error('Error processing result URL:', item.url, error);
                }
              }
            }

            // 更新任务结果
            if (results.length > 0) {
              await updatePaintboardTaskResults({ taskId, results: results as any });
              console.log(`Task ${taskId} completed successfully with ${results.length} results`);
              return results;
            } else {
              throw new Error('No valid results found');
            }
          } else if (result.status === 'failed') {
            // 任务失败
            const errorMessage = 'Task failed';
            throw new Error(errorMessage);
          } else {
            // 任务仍在处理中，等待后继续轮询
            console.log(`Task ${taskId} still processing, waiting ${retryDelay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
          }
        } catch (error) {
          // 如果是任务失败，直接抛出错误
          if (error instanceof Error && error.message.includes('Task failed')) {
            throw error;
          }

          // 其他错误，记录并继续重试
          console.error(`Error polling task ${taskId}, attempt ${retryCount + 1}:`, error);
          retryCount++;

          if (retryCount >= maxRetries) {
            throw new Error(`Max retries (${maxRetries}) exceeded for task ${taskId}`);
          }

          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // 达到最大重试次数，任务超时
      throw new Error(`Task ${taskId} timed out after ${maxRetries} attempts`);
    } catch (error) {
      console.error('Error processing paintboard task result:', error);

      // 更新任务状态为失败
      await updatePaintboardTaskStatus({
        taskId,
        status: PaintboardTaskStatus.FAILED,
        error: (error as Error).message,
      });

      throw error;
    }
  },
);

// 后台轮询任务结果
export const pollPaintboardTaskResults = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  try {
    // 获取所有处理中的任务
    const processingTasks = await prisma.paintboardTasks.findMany({
      where: {
        status: PaintboardTaskStatus.PROCESSING,
      },
    });

    const results = [];

    for (const task of processingTasks) {
      try {
        const result = await processPaintboardTaskResult({
          taskId: task.id,
          service: task.service,
          model: task.model,
          generationType: task.generationType as GenerationType,
          externalTaskId: task.taskId!,
          maxRetries: 30, // 最多重试30次
          retryDelay: 3000, // 每次重试间隔2秒
        });

        results.push({
          taskId: task.id,
          result,
        });
      } catch (error) {
        console.error(`Error polling task ${task.id}:`, error);
        results.push({
          taskId: task.id,
          error: (error as Error).message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error polling paintboard task results:', error);
    throw error;
  }
});

// 提交生成任务
export const submitGenerationTask = withUserAuth(
  async ({
    args,
    organization,
  }: AuthWrapperContext<{
    service: string;
    model: string;
    generationType: GenerationType;
    params: any;
  }>) => {
    const { service, model, generationType, params } = args;

    try {
      // 1. 创建数据库任务记录
      const taskRecord = await createPaintboardTask({
        service,
        model,
        generationType,
        params,
      });

      if (!taskRecord.data) {
        throw new Error('Failed to create task record');
      }

      const taskId = taskRecord.data.id;

      // 2. 使用统一接口提交任务到外部服务
      const manager = AdapterManager.getInstance();
      const result = await manager.submitGenerationTask(service, model, generationType, params);

      // 3. 检查提交结果并更新数据库
      if (result && result.success && result.taskId) {
        // 更新任务状态为处理中，并记录外部任务ID
        await updatePaintboardTaskStatus({
          taskId,
          status: PaintboardTaskStatus.PROCESSING,
          externalTaskId: result.taskId,
        });

        // 4. 启动后台轮询（异步执行，不阻塞响应）
        setTimeout(async () => {
          try {
            await processPaintboardTaskResult({
              taskId,
              service,
              model,
              generationType,
              externalTaskId: result.taskId!,
              maxRetries: 30, // 最多重试30次
              retryDelay: 2000, // 每次重试间隔2秒
            });
          } catch (error) {
            console.error('Background polling failed:', error);
          }
        }, 1000);

        return {
          success: true,
          data: {
            taskId,
            externalTaskId: result.taskId,
            status: 'processing',
          },
        };
      } else {
        // 提交失败，更新任务状态
        const errorMessage = result && typeof result === 'object' && 'error' in result ? result.error : 'Unknown error';
        await updatePaintboardTaskStatus({
          taskId,
          status: PaintboardTaskStatus.FAILED,
          error: errorMessage as string,
        });

        throw new Error('Failed to submit task to external service');
      }
    } catch (error) {
      console.error('Error submitting generation task:', error);
      return { success: false, error: (error as Error).message };
    }
  },
);
