import { chatOnce } from '@/actions/chat';
import { BaseNodeActionData, BaseNodeProcessor, FlowGraphNode, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type TextNodeActionData = {
  prompt?: string;
  modelId?: string;
};

// 文本节点处理器
export class TextNodeProcessor extends BaseNodeProcessor<TextNodeActionData> {
  async execute(data: BaseNodeActionData<TextNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { images, texts } = data.input;
    const { actionData } = data;

    // 如果输入全部为空，则直接返回
    if (images.length === 0 && texts.length === 0 && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    const prompt = (actionData?.prompt || '').concat(texts.join('\n'));

    if (!actionData?.modelId) {
      return {
        success: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: 'Invalid model',
      };
    }

    const result = await chatOnce({
      modelId: actionData.modelId,
      content: prompt,
    });

    return {
      success: true,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      data: { texts: [(result.data?.choices[0]?.message?.content as string) || ''] },
    };
  }
}
