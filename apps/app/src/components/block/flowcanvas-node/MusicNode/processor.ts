import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type MusicNodeActionData = {
  lyrics?: string;
  prompt?: string;
  selectedModel?: string;
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

    let processedLyrics = lyrics || '';
    let processedPrompt = prompt || '';

    // 处理 lyrics 中的 @text 提及
    const textPattern = /@text:([^\s]+)/g;
    const lyricsMatches = [...processedLyrics.matchAll(textPattern)];
    lyricsMatches.forEach(match => {
      const nodeId = match[1];
      if (nodeId) {
        const textNode = data.input.texts.find(text => text.nodeId === nodeId);
        if (textNode?.texts?.[0]) {
          processedLyrics = processedLyrics.replace(match[0], textNode.texts[0]);
        }
      }
    });

    // 处理 prompt 中的 @text 提及
    const promptMatches = [...processedPrompt.matchAll(textPattern)];
    promptMatches.forEach(match => {
      const nodeId = match[1];
      if (nodeId) {
        const textNode = data.input.texts.find(text => text.nodeId === nodeId);
        if (textNode?.texts?.[0]) {
          processedPrompt = processedPrompt.replace(match[0], textNode.texts[0]);
        }
      }
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

    const expiredTime = startTime + 5 * 60 * 1000;

    while (Date.now() < expiredTime) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const taskResult = await getPaintboardTask({ taskId: result.data.id });
      if (taskResult.data?.status === 'completed') {
        // 存储key而不是URL
        return {
          success: true,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          data: { musics: taskResult.data.results.map(result => result.key) },
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
          error: taskResult.data.error || 'Failed to generate music',
          data: { musics: [] },
        };
      }
    }

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: 'Failed to generate music',
      data: { musics: [] },
    };
  }
}
