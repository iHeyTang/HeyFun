import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { pollGenerationTask, resultMappers } from '../../flowcanvas/utils/task-polling';

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
    const videos = data.input.videos.map(video => video.videos || []).flat();
    const audios = data.input.audios.map(audio => audio.audios || []).flat();

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
    const inputVideoKey = videos[0];
    const inputAudioKey = audios[0];

    if (!inputVideoKey || !inputAudioKey) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: '视频或音频Key无效',
      };
    }

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        video: `/api/oss/${inputVideoKey}`,
        audio: `/api/oss/${inputAudioKey}`,
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

    // 使用工具函数轮询任务状态
    return pollGenerationTask({
      taskId: result.data.id,
      timeout: 10 * 60 * 1000, // 唇形同步需要较长时间，10分钟
      startTime,
      resultMapper: resultMappers.videos,
      errorMessage: {
        failed: '唇形同步失败',
        timeout: '唇形同步超时',
      },
    });
  }
}
