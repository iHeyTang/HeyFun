import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type ImageNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  aspectRatio?: string;
  selectedKey?: string;
};

// 图片节点处理器
export class ImageNodeProcessor extends BaseNodeProcessor<ImageNodeActionData> {
  async execute(data: BaseNodeActionData<ImageNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { prompt, selectedModel, aspectRatio, selectedKey } = actionData || {};

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
        const imageExists = images.includes(imageKey);
        if (imageExists) {
          mentionedImages.push(`/api/oss/${imageKey}`);
          processedPrompt = processedPrompt.replace(match[0], `图${index + 1}`);
        }
      }
    });

    const selectedImage = images.find(key => key === selectedKey);

    // 如果 prompt 中有提及图片，使用提及的图片；否则使用输入的所有图片
    const referenceImages = mentionedImages.length > 0 ? mentionedImages : selectedImage ? [selectedImage] : images[0] ? [images[0]] : [];

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        prompt: processedPrompt,
        aspectRatio,
        referenceImage: referenceImages,
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

    const expiredTime = startTime + 5 * 60 * 1000;

    while (Date.now() < expiredTime) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const taskResult = await getPaintboardTask({ taskId: result.data.id });
      console.log('taskResult', taskResult);
      if (taskResult.data?.status === 'completed') {
        // 存储key而不是URL
        return {
          success: true,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          data: { images: taskResult.data.results.map(result => result.key) },
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
          error: taskResult.data.error || 'Failed to generate image',
          data: { images: [] },
        };
      }
    }

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: 'Failed to generate image',
      data: { images: [] },
    };
  }
}
