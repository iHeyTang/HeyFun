import { getPaintboardTask, submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeActionData, BaseNodeProcessor, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type AudioNodeActionData = {
  prompt?: string;
  selectedModel?: string;
  voiceId?: string;
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
          data: { audios: taskResult.data.results.map(result => result.key) },
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
          error: taskResult.data.error || 'Failed to generate audio',
          data: { audios: [] },
        };
      }
    }

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: 'Failed to generate audio',
      data: { audios: [] },
    };
  }
}
