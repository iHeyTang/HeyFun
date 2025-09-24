import { getSignedUrl, getSignedUrls } from '@/actions/oss';
import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeProcessor, FlowGraphNode, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type ImageNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  aspectRatio?: string;
};

// 图片节点处理器
export class ImageNodeProcessor extends BaseNodeProcessor<ImageNodeActionData> {
  async execute(node: FlowGraphNode<ImageNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { images, texts } = this.parseInputs(node);
    const { actionData } = node.data;
    const { prompt, selectedModel, aspectRatio } = actionData || {};

    // 如果输入全部为空，则直接返回
    if (images.length === 0 && texts.length === 0 && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
        data: node.data.output,
      };
    }

    if (!prompt || !selectedModel || !aspectRatio) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: 'Invalid prompt, model, or aspect ratio',
      };
    }

    const result = await submitGenerationTask({
      model: selectedModel,
      params: { prompt, aspectRatio, referenceImage: images },
    });

    console.log('result', result);

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
        const urls = await getSignedUrls({ fileKeys: taskResult.data.results.map(result => result.key) });

        return {
          success: true,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          data: { images: urls.data?.map(url => ({ url })) },
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
