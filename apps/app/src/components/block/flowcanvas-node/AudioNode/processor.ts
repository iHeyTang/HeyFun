import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { processMentions } from '../../flowcanvas/utils/prompt-processor';
import { pollGenerationTask, resultMappers } from '../../flowcanvas/utils/task-polling';

export type AudioNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  voiceId?: string;
  advancedParams?: Record<string, any>;
};

// 音频节点处理器
export class AudioNodeProcessor extends BaseNodeProcessor<AudioNodeActionData> {
  async execute(data: BaseNodeActionData<AudioNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { prompt, selectedModel, voiceId } = actionData || {};

    // 如果输入全部为空，则直接返回
    if (!actionData?.prompt) {
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
        error: 'Invalid prompt or model',
      };
    }

    // 使用工具函数处理 prompt 中的 @text 提及
    const { processedPrompt } = processMentions(prompt, {
      textNodes: data.input.texts,
      availableImages: [],
    });

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        text: processedPrompt,
        voice_id: voiceId,
      },
    });

    if (result.error || !result.data?.id) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: result.error,
        data: { audios: [] },
      };
    }

    // 使用工具函数轮询任务状态
    return pollGenerationTask({
      taskId: result.data.id,
      startTime,
      resultMapper: resultMappers.audios,
      errorMessage: {
        failed: 'Failed to generate audio',
        timeout: 'Audio generation timeout',
      },
    });
  }
}
