import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { ToAsyncTaskManager } from '../../utils/to-async-task';

const paramsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).min(0).max(10).optional(),
  n: z.enum(['1', '2', '4']).optional(),
});

type ChatCompletionsResponse = {
  id: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message: string };
};

const toAsync = new ToAsyncTaskManager<ChatCompletionsResponse>();

/**
 * Gemini 3.0 Pro Image
 * https://doc.302.ai/342037238e0
 */
export class Gemini30ProImage extends BaseAigcModel {
  name = 'gemini-3-0-pro-image';
  displayName = 'Gemini Nano Banana Pro';
  description = 'Gemini Nano Banana Pro';
  costDescription = '1 Credits / image';
  generationTypes = ['text-to-image', 'image-to-image'] as GenerationType[];

  tags = ['recommended'];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const path = '/v1/chat/completions';

    // 根据 n 参数确定需要生成的数量
    const count = params.n ? parseInt(params.n) : 1;
    const requestIds: string[] = [];

    // 构建 messages content 数组
    const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: params.prompt,
      },
    ];

    // 如果有参考图片，添加到 content 中
    if (params.referenceImage && params.referenceImage.length > 0) {
      for (const imageUrl of params.referenceImage) {
        content.push({
          type: 'image_url',
          image_url: {
            url: imageUrl,
          },
        });
      }
    }

    // 提交多个任务
    for (let i = 0; i < count; i++) {
      const task = toAsync.addTask(
        this.provider.request<ChatCompletionsResponse>({
          path,
          method: 'POST',
          body: {
            model: 'gemini-3-pro-image-preview',
            stream: false,
            messages: [
              {
                role: 'user',
                content,
              },
            ],
          },
        }),
      );
      requestIds.push(task.id);
    }

    // 用逗号分隔多个 request_id
    return requestIds.join(',');
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    // 解析多个 taskId（用逗号分隔）
    const taskIds = params.taskId.split(',');
    const results: Array<{ data: string; sourceType: 'base64' | 'url' }> = [];
    const errors: string[] = [];
    let hasProcessing = false;

    // 处理所有任务
    for (const taskId of taskIds) {
      const task = toAsync.getTask(taskId);
      if (!task) {
        errors.push(`Task ${taskId}: Task not found`);
        continue;
      }

      // 检查任务状态
      if (task.status === 'pending') {
        hasProcessing = true;
        continue;
      }

      if (task.status === 'failed') {
        errors.push(`Task ${taskId}: ${task.error || 'Unknown error'}`);
        continue;
      }

      if (task.status === 'succeeded' && task.result) {
        // 从响应中提取图片
        const data = task.result;

        // 检查是否有错误
        if (data.error) {
          errors.push(`Task ${taskId}: ${data.error.message || 'Request failed'}`);
          continue;
        }

        // 从 choices 中提取图片（可能是 base64 或 URL）
        if (data.choices && data.choices.length > 0) {
          for (const choice of data.choices) {
            if (choice.message?.content) {
              const content = choice.message.content;
              if (typeof content === 'string' && content.trim()) {
                // 检查是否是 Markdown 格式的 base64 图片链接
                const markdownImageRegex = /!\[[^\]]*\]\(data:image\/([^;]+);base64,([^)]+)\)/;
                const markdownMatch = content.match(markdownImageRegex);
                if (markdownMatch && markdownMatch[2]) {
                  // 提取 base64 数据部分
                  results.push({ data: markdownMatch[2], sourceType: 'base64' });
                  continue;
                }

                // 检查是否是 URL（http:// 或 https://）
                const urlRegex = /^https?:\/\/.+/;
                if (urlRegex.test(content.trim())) {
                  results.push({ data: content.trim(), sourceType: 'url' });
                  continue;
                }

                // 检查是否是 Markdown 格式的 URL 图片链接
                const markdownUrlRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/;
                const markdownUrlMatch = content.match(markdownUrlRegex);
                if (markdownUrlMatch && markdownUrlMatch[1]) {
                  results.push({ data: markdownUrlMatch[1], sourceType: 'url' });
                  continue;
                }

                // 否则假设是纯 base64 字符串
                results.push({ data: content.trim(), sourceType: 'base64' });
              }
            }
          }
        }
      }
    }

    // 如果还有任务在处理中，返回处理中状态
    if (hasProcessing) {
      return {
        status: 'processing',
      };
    }

    // 如果所有任务都失败了，抛出错误
    if (results.length === 0 && errors.length > 0) {
      throw new Error(`All tasks failed:\n${errors.join('\n')}`);
    }

    // 返回成功的结果（即使部分任务失败）
    return {
      status: 'completed',
      data: results.map(result => ({ data: result.data, sourceType: result.sourceType, type: 'image' })),
      usage: { image_count: results.length },
    };
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    const count = params.n ? parseInt(params.n) : 1;
    return 1000 * count;
  }
}
