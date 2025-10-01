import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type VideoNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  aspectRatio?: string;
  duration?: string;
};

// 视频节点处理器
export class VideoNodeProcessor extends BaseNodeProcessor<VideoNodeActionData> {
  async execute(data: BaseNodeActionData<VideoNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { images, texts } = data.input;
    const { actionData } = data;
    const { prompt, selectedModel, aspectRatio, duration } = actionData || {};

    // 如果输入全部为空，则直接返回
    if (images.length === 0 && texts.length === 0 && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    if (!prompt || !selectedModel || !aspectRatio || !duration) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: 'Invalid prompt, model, aspect ratio, or duration',
      };
    }

    const referenceImages = images.map(image => image.images?.map(image => image.url!)).flat();
    const result = await submitGenerationTask({
      model: selectedModel,
      params: { prompt, aspectRatio, duration: Number(duration), firstFrame: referenceImages?.[0] },
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
      console.log('video taskResult', taskResult);
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
