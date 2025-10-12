/**
 * 任务轮询工具
 * 用于轮询查询生成任务状态，直到任务完成、失败或超时
 *
 * 遵循最小依赖原则，核心逻辑与具体业务解耦
 */

import { NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { getPaintboardTask } from '@/actions/paintboard';

/**
 * 任务状态类型
 */
export type TaskStatus = 'completed' | 'pending' | 'failed';

/**
 * 任务查询结果
 */
export interface TaskResult<T = any> {
  status: TaskStatus;
  results?: Array<{ key: string; url?: string }>;
  error?: string;
  data?: T;
}

/**
 * 轮询配置选项
 */
export interface PollingOptions<TData = any> {
  /** 任务 ID */
  taskId: string;
  /** 超时时间（毫秒），默认 5 分钟 */
  timeout?: number;
  /** 轮询间隔（毫秒），默认 5 秒 */
  interval?: number;
  /** 任务开始时间戳，用于计算执行时间 */
  startTime: number;
  /** 结果映射函数，将任务结果转换为节点输出数据 */
  resultMapper: (results: Array<{ key: string }>) => TData;
  /** 错误消息，任务失败或超时时使用 */
  errorMessage?: {
    failed?: string;
    timeout?: string;
  };
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS = {
  timeout: 5 * 60 * 1000, // 5 分钟
  interval: 5000, // 5 秒
  errorMessage: {
    failed: 'Task failed',
    timeout: 'Task timeout',
  },
};

/**
 * 轮询查询生成任务状态
 *
 * 此函数会持续轮询任务状态，直到：
 * 1. 任务完成 - 返回成功结果
 * 2. 任务失败 - 返回失败结果
 * 3. 超时 - 返回超时错误
 *
 * @param options - 轮询配置选项
 * @returns 节点执行结果
 *
 * @example
 * // 轮询视频生成任务
 * const result = await pollGenerationTask({
 *   taskId: 'task-123',
 *   timeout: 10 * 60 * 1000, // 10 分钟
 *   startTime: Date.now(),
 *   resultMapper: (results) => ({ videos: results.map(r => r.key) }),
 *   errorMessage: {
 *     failed: 'Failed to generate video',
 *     timeout: 'Video generation timeout'
 *   }
 * });
 */
export async function pollGenerationTask<TData = any>(options: PollingOptions<TData>): Promise<NodeExecutorExecuteResult> {
  const {
    taskId,
    timeout = DEFAULT_OPTIONS.timeout,
    interval = DEFAULT_OPTIONS.interval,
    startTime,
    resultMapper,
    errorMessage = DEFAULT_OPTIONS.errorMessage,
  } = options;

  const expiredTime = startTime + timeout;

  while (Date.now() < expiredTime) {
    // 等待指定间隔
    await new Promise(resolve => setTimeout(resolve, interval));

    try {
      // 查询任务状态
      const taskResult = await getPaintboardTask({ taskId });

      if (!taskResult.data) {
        // 数据不存在，继续轮询
        continue;
      }

      const status = taskResult.data.status;

      // 任务完成
      if (status === 'completed') {
        const results = taskResult.data.results;

        if (!results || results.length === 0) {
          return createFailureResult(startTime, errorMessage.failed || DEFAULT_OPTIONS.errorMessage.failed, resultMapper([]));
        }

        return createSuccessResult(startTime, resultMapper(results));
      }

      // 任务进行中，继续轮询
      if (status === 'pending') {
        continue;
      }

      // 任务失败
      if (status === 'failed') {
        return createFailureResult(startTime, taskResult.data.error || errorMessage.failed || DEFAULT_OPTIONS.errorMessage.failed, resultMapper([]));
      }
    } catch (error) {
      // 查询出错，记录日志但继续轮询
      console.error('Poll task error:', error);
      continue;
    }
  }

  // 超时
  return createFailureResult(startTime, errorMessage.timeout || DEFAULT_OPTIONS.errorMessage.timeout, resultMapper([]));
}

/**
 * 创建成功结果
 */
function createSuccessResult<TData>(startTime: number, data: TData): NodeExecutorExecuteResult {
  return {
    success: true,
    timestamp: new Date(),
    executionTime: Date.now() - startTime,
    data: data as any,
  };
}

/**
 * 创建失败结果
 */
function createFailureResult<TData>(startTime: number, error: string, data?: TData): NodeExecutorExecuteResult {
  return {
    success: false,
    timestamp: new Date(),
    executionTime: Date.now() - startTime,
    error,
    data: data as any,
  };
}

/**
 * 通用结果映射器工厂函数
 * 用于快速创建常见类型的结果映射器
 */
export const resultMappers = {
  /** 视频结果映射器 */
  videos: (results: Array<{ key: string }>) => ({
    videos: results.map(r => r.key),
  }),

  /** 图片结果映射器 */
  images: (results: Array<{ key: string }>) => ({
    images: results.map(r => r.key),
  }),

  /** 音频结果映射器 */
  audios: (results: Array<{ key: string }>) => ({
    audios: results.map(r => r.key),
  }),

  /** 音乐结果映射器 */
  musics: (results: Array<{ key: string }>) => ({
    musics: results.map(r => r.key),
  }),
};
