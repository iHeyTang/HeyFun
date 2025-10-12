import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { processMentions } from '../../flowcanvas/utils/prompt-processor';
import { pollGenerationTask, resultMappers } from '../../flowcanvas/utils/task-polling';

export type VideoNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
};

// 视频节点处理器
export class VideoNodeProcessor extends BaseNodeProcessor<VideoNodeActionData> {
  async execute(data: BaseNodeActionData<VideoNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { prompt, selectedModel, aspectRatio, duration, resolution } = actionData || {};

    const images = data.input.images.map(image => image.images || []).flat();

    // 如果输入全部为空，则直接返回
    if (images.length === 0 && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    if (!prompt || !selectedModel) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: 'Invalid prompt, model, aspect ratio, duration, or resolution',
      };
    }

    // 使用工具函数处理 prompt 中的所有提及
    const { processedPrompt, mentionedImages } = processMentions(prompt, {
      textNodes: data.input.texts,
      availableImages: images,
    });

    // 如果 prompt 中有提及图片，使用提及的图片；否则使用输入的所有图片
    const referenceImages = mentionedImages.length > 0 ? mentionedImages : images[0] ? [images[0]] : [];

    const result = await submitGenerationTask({
      model: selectedModel,
      params: { prompt: processedPrompt, aspectRatio, duration, firstFrame: referenceImages?.[0], resolution },
    });

    if (result.error || !result.data?.id) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: result.error,
        data: { videos: [] },
      };
    }

    // 使用工具函数轮询任务状态
    return pollGenerationTask({
      taskId: result.data.id,
      timeout: 10 * 60 * 1000, // 视频生成需要更长时间，10分钟
      startTime,
      resultMapper: resultMappers.videos,
      errorMessage: {
        failed: 'Failed to generate video',
        timeout: 'Video generation timeout',
      },
    });
  }
}
