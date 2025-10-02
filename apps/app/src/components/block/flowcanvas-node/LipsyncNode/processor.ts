import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type LipsyncNodeActionData = {
  selectedModel?: string;
};

// 唇形同步节点处理器
export class LipsyncNodeProcessor extends BaseNodeProcessor<LipsyncNodeActionData> {
  async execute(data: BaseNodeActionData<LipsyncNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { selectedModel } = actionData || {};

    // 获取输入的视频和音频
    const videos = data.input.videos.map(video => video.videos?.map(v => v)).flat();
    const audios = data.input.audios.map(audio => audio.audios?.map(a => a)).flat();

    // 如果没有视频或音频输入，则直接返回
    if (videos.length === 0 || audios.length === 0) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: '缺少视频或音频输入',
      };
    }

    if (!selectedModel) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: '未选择模型',
      };
    }

    // 使用第一个视频和第一个音频
    const inputVideo = videos[0];
    const inputAudio = audios[0];

    if (!inputVideo?.url || !inputAudio?.url) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: '视频或音频URL无效',
      };
    }

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        video: inputVideo.url,
        audio: inputAudio.url,
      },
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

    const expiredTime = startTime + 10 * 60 * 1000; // 唇形同步需要较长时间，10分钟

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
          error: taskResult.data.error || '唇形同步失败',
          data: { videos: [] },
        };
      }
    }

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: '唇形同步超时',
      data: { videos: [] },
    };
  }
}
