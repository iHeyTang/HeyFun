import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

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

    const images = data.input.images.map(image => image.images?.map(img => img)).flat();

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

    let processedPrompt = prompt;

    // 处理 prompt 中的 @text 提及
    const textPattern = /@text:([^\s]+)/g;
    const textMatches = [...prompt.matchAll(textPattern)];
    textMatches.forEach(match => {
      const nodeId = match[1];
      if (nodeId) {
        const textNode = data.input.texts.find(text => text.nodeId === nodeId);
        if (textNode?.texts?.[0]) {
          processedPrompt = processedPrompt.replace(match[0], textNode.texts[0]);
        }
      }
    });

    // 处理 prompt 中的 @image 提及
    const imagePattern = /@image:([^\s]+)/g;
    const mentionedImages: string[] = [];

    // 提取所有提及的图片key，并替换为"图X"
    const imageMatches = [...processedPrompt.matchAll(imagePattern)];
    imageMatches.forEach((match, index) => {
      const imageKey = match[1];
      if (imageKey) {
        const image = images.find(image => image?.key === imageKey);
        if (image && image?.url) {
          mentionedImages.push(image.url);
          processedPrompt = processedPrompt.replace(match[0], `图${index + 1}`);
        }
      }
    });

    // 如果 prompt 中有提及图片，使用提及的图片；否则使用输入的所有图片
    const referenceImages = mentionedImages.length > 0 ? mentionedImages : images[0]?.url ? [images[0].url] : [];

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

    const expiredTime = startTime + 10 * 60 * 1000; // 视频生成需要更长时间，10分钟

    while (Date.now() < expiredTime) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const taskResult = await getPaintboardTask({ taskId: result.data.id });
      if (taskResult.data?.status === 'completed') {
        // 存储key而不是URL
        return {
          success: true,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          data: { videos: taskResult.data.results.map(result => ({ key: result.key })) },
        };
      }

      if (taskResult.data?.status === 'pending') {
        continue;
      }

      if (taskResult.data?.status === 'failed') {
        return {
          success: false,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          error: taskResult.data.error || 'Failed to generate video',
          data: { videos: [] },
        };
      }
    }

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: 'Failed to generate video',
      data: { videos: [] },
    };
  }
}
