import { ToolContext } from '../../context';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import storage, { extractOssFileKey, validateOssFileAccess } from '@/lib/server/storage';
import AIGC, { speechToTextParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { transcribeMediaParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';

/**
 * 将秒数转换为SRT时间格式 (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * 将转录结果转换为SRT格式
 */
function convertToSrt(segments: Array<{ start: number; end: number; text: string }>): string {
  return segments
    .map((segment, index) => {
      const startTime = formatSrtTime(segment.start);
      const endTime = formatSrtTime(segment.end);
      const text = segment.text.trim();
      return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    })
    .join('\n');
}

/**
 * 从 data URL 中解析 JSON 数据
 */
function parseDataUrl(dataUrl: string | undefined): any {
  if (!dataUrl) return null;
  try {
    if (dataUrl.startsWith('data:application/json')) {
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) return null;
      const jsonString = decodeURIComponent(base64Data);
      return JSON.parse(jsonString);
    }
    return null;
  } catch (error) {
    console.error('[TranscribeMedia] Failed to parse data URL:', error);
    return null;
  }
}

export const transcribeMediaExecutor = definitionToolExecutor(
  transcribeMediaParamsSchema,
  async (args, context) => {
    const { error, task } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
      const { fileUrl, model, outputFormat = 'text', language, prompt } = args;

      if (!context.organizationId) {
        return { error: 'Organization ID is required' };
      }

      // 解析文件URL
      let fileKey: string | null = null;
      let fileUrlToUse: string;

      if (fileUrl.startsWith('oss://')) {
        // OSS路径格式
        fileKey = extractOssFileKey(fileUrl);
        validateOssFileAccess(fileKey, context.organizationId);
        fileUrlToUse = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
      } else if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        // 完整URL
        fileUrlToUse = fileUrl;
      } else {
        // 假设是OSS文件key
        fileKey = fileUrl;
        validateOssFileAccess(fileKey, context.organizationId);
        fileUrlToUse = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
      }

      // 获取或选择语音识别模型
      let selectedModel = model;
      if (!selectedModel) {
        // 自动选择可用的语音识别模型
        const allModels = await AIGC.getAllServiceModels();
        const sttModels = allModels.filter(m => m.generationTypes.includes('speech-to-text'));
        if (sttModels.length === 0) {
          return { error: 'No speech-to-text models available. Please configure a speech recognition provider.' };
        }
        // 优先选择 bytedance-openspeech-stt，否则选择第一个
        const preferredModel = sttModels.find(m => m.name === 'bytedance-openspeech-stt');
        selectedModel = preferredModel?.name || (sttModels[0] ? sttModels[0].name : undefined);
        if (!selectedModel) {
          return { error: 'Failed to select a speech-to-text model' };
        }
      }

      // 获取模型信息
      const modelInstance = AIGC.getModel(selectedModel);
      if (!modelInstance) {
        return { error: `Model "${selectedModel}" not found. Use get_aigc_models to see available models.` };
      }

      // 验证模型是否支持speech-to-text
      if (!modelInstance.generationTypes.includes('speech-to-text')) {
        return {
          error: `Model "${selectedModel}" does not support speech-to-text. Supported types: ${modelInstance.generationTypes.join(', ')}`,
        };
      }

      // 检查余额
      const credit = await prisma.credit.findUnique({ where: { organizationId: context.organizationId } });
      if (!credit || credit.amount <= 0) {
        return { error: 'Insufficient balance' };
      }

      // 从文件URL中提取格式
      let format: string | undefined;
      if (fileUrlToUse.includes('.')) {
        const extension = fileUrlToUse.split('.').pop()?.toLowerCase();
        if (extension && ['wav', 'mp3', 'm4a', 'flac', 'aac', 'mp4', 'avi', 'mov', 'webm'].includes(extension)) {
          format = extension;
        }
      }

      // 构建参数
      const params: z.infer<typeof speechToTextParamsSchema> = {
        audio: fileUrlToUse,
      };

      // 只有当 language 存在且不是 'auto' 时才传递
      if (language && language !== 'auto') {
        params.language = language;
      }

      if (format || prompt) {
        params.advanced = {
          ...(format && { format }),
          // prompt 参数在某些模型中可能不支持，这里先不传递
        };
      }

      // 创建数据库任务记录
      const createdTask = await prisma.paintboardTasks.create({
        data: {
          organizationId: context.organizationId,
          service: 'unknown',
          model: selectedModel,
          generationType: 'speech-to-text',
          params: params as any,
          status: 'pending',
        },
      });

      // 触发 paintboard workflow
      await workflow.trigger({
        url: '/api/workflow/paintboard',
        body: { taskId: createdTask.id },
        flowControl: { key: `paintboard-${context.organizationId}`, parallelism: 2 },
      });

      return { task: createdTask, outputFormat };
    });

    if (error || !task) {
      return {
        success: false,
        error: error || 'Task creation failed',
      };
    }

    // 从 workflow 返回的数据中获取 outputFormat
    const outputFormat = (task as any).outputFormat || args.outputFormat || 'text';

    // waitForEvent 需要使用不同的 step name
    const result = await context.workflow.waitForEvent<{ taskId: string; results?: PrismaJson.PaintboardTaskResult; error?: string }>(
      `toolcall-${context.toolCallId}-wait`,
      `paintboard-result-${task.id}`,
    );

    if (result.eventData?.error) {
      return {
        success: false,
        error: result.eventData.error,
      };
    }

    // 从数据库获取任务结果，因为语音识别返回的是文本，可能不会上传到 OSS
    const completedTask = await prisma.paintboardTasks.findUnique({
      where: { id: task?.id },
    });

    if (!completedTask || completedTask.status !== 'completed') {
      return {
        success: false,
        error: completedTask?.error || 'Task not completed',
      };
    }

    // 对于语音识别，我们需要从原始结果中获取数据
    // 重新获取任务结果（从 AIGC 系统）
    const modelInstance = AIGC.getModel(completedTask.model);
    if (!modelInstance) {
      return {
        success: false,
        error: `Model "${completedTask.model}" not found`,
      };
    }

    if (!completedTask.taskId) {
      return {
        success: false,
        error: 'Task ID not found',
      };
    }

    const aigcResult = await AIGC.getTaskResult({
      modelName: completedTask.model,
      taskId: completedTask.taskId,
      params: completedTask.params as any,
    });

    if (aigcResult.status !== 'completed' || !aigcResult.data || aigcResult.data.length === 0) {
      return {
        success: false,
        error: aigcResult.error || 'No transcription result found',
      };
    }

    // 从返回结果中提取数据
    const resultData = aigcResult.data[0];
    if (!resultData) {
      return {
        success: false,
        error: 'No result data found',
      };
    }

    if (resultData.sourceType === 'url' && typeof resultData.data === 'string' && resultData.data.startsWith('data:application/json')) {
      // 解析 JSON 数据
      const parsedData = parseDataUrl(resultData.data);
      if (!parsedData) {
        return {
          success: false,
          error: 'Failed to parse transcription result',
        };
      }

      const { text, segments, language: detectedLanguage, duration } = parsedData;

      if (outputFormat === 'srt') {
        // 生成 SRT 格式
        if (!segments || segments.length === 0) {
          return {
            success: false,
            error: 'No transcription segments found for SRT format',
          };
        }

        const srtContent = convertToSrt(segments);

        return {
          success: true,
          data: {
            text: text || '',
            srt: srtContent,
            language: detectedLanguage || 'unknown',
            duration: duration || 0,
          },
        };
      } else {
        // 纯文本格式
        return {
          success: true,
          data: {
            text: text || '',
            language: detectedLanguage || 'unknown',
            duration: duration || 0,
          },
        };
      }
    }

    // 如果返回的不是预期的格式，尝试直接使用文本
    return {
      success: false,
      error: 'Unexpected result format from transcription service',
    };
  },
);

