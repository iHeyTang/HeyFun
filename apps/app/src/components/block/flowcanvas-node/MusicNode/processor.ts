import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';
import { processMentions } from '../../flowcanvas/utils/prompt-processor';
import { pollGenerationTask, resultMappers } from '../../flowcanvas/utils/task-polling';

export type MusicNodeActionData = {
  lyrics?: string;
  prompt?: string;
  selectedModel?: string;
  advancedParams?: Record<string, any>;
};

// 音乐节点处理器
export class MusicNodeProcessor extends BaseNodeProcessor<MusicNodeActionData> {
  async execute(data: BaseNodeActionData<MusicNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { actionData } = data;
    const { lyrics, prompt, selectedModel } = actionData || {};

    // 如果输入全部为空，则直接返回
    if (!actionData?.lyrics && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    if (!selectedModel) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: 'Invalid model',
      };
    }

    // 使用工具函数处理 lyrics 和 prompt 中的 @text 提及
    const { processedPrompt: processedLyrics } = processMentions(lyrics || '', {
      textNodes: data.input.texts,
      availableImages: [],
    });
    const { processedPrompt } = processMentions(prompt || '', {
      textNodes: data.input.texts,
      availableImages: [],
    });

    const result = await submitGenerationTask({
      model: selectedModel,
      params: {
        lyrics: processedLyrics,
        prompt: processedPrompt,
      },
    });

    if (result.error || !result.data?.id) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: result.error,
        data: { musics: [] },
      };
    }

    // 使用工具函数轮询任务状态
    return pollGenerationTask({
      taskId: result.data.id,
      startTime,
      resultMapper: resultMappers.musics,
      errorMessage: {
        failed: 'Failed to generate music',
        timeout: 'Music generation timeout',
      },
    });
  }
}
