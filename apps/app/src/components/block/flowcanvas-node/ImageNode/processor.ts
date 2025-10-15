import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { processMentions } from '../../flowcanvas/utils/prompt-processor';
import { pollGenerationTask, resultMappers } from '../../flowcanvas/utils/task-polling';

export type ImageNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  aspectRatio?: string;
  n?: string;
  advancedParams?: Record<string, any>;
};

// 图片节点处理器
export class ImageNodeProcessor extends BaseNodeProcessor<ImageNodeActionData> {
  async execute(data: BaseNodeActionData<ImageNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { prompt, selectedModel, aspectRatio, n } = actionData || {};

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
        error: 'Invalid prompt, model, or aspect ratio',
      };
    }

    // 使用工具函数处理 prompt 中的所有提及
    const { processedPrompt, mentionedImages } = processMentions(prompt, {
      textNodes: data.input.texts,
      availableImages: data.input.images,
    });

    // 将提及的图片 key 转换为完整 URL
    const mentionedImageUrls = mentionedImages;

    // 如果 prompt 中有提及图片，使用提及的图片；否则使用选中的或第一张图片
    const referenceImages = mentionedImageUrls.length > 0 ? mentionedImageUrls : images ? images.map(i => i.selected) : [];

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        prompt: processedPrompt,
        aspectRatio,
        referenceImage: referenceImages,
        n,
      },
    });

    if (result.error || !result.data?.id) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: result.error,
        data: { images: [] },
      };
    }

    // 使用工具函数轮询任务状态
    return pollGenerationTask({
      taskId: result.data.id,
      startTime,
      resultMapper: resultMappers.images,
      errorMessage: {
        failed: 'Failed to generate image',
        timeout: 'Image generation timeout',
      },
    });
  }
}
