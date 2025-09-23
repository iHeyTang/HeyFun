import { chatOnce } from '@/actions/chat';
import { BaseNodeProcessor, FlowGraphNode, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type TextNodeActionData = {
  prompt?: string;
  modelProvider?: string;
  modelId?: string;
};

// 文本节点处理器
export class TextNodeProcessor extends BaseNodeProcessor<TextNodeActionData> {
  async execute(node: FlowGraphNode<TextNodeActionData>): Promise<NodeExecutorExecuteResult> {
    const startTime = Date.now();
    const { images, texts } = this.parseInputs(node);
    const { actionData } = node.data;

    // 如果输入全部为空，则直接返回
    if (images.length === 0 && texts.length === 0 && !actionData?.prompt) {
      return {
        success: true,
        timestamp: new Date(),
        data: node.data.output,
      };
    }

    const prompt = (actionData?.prompt || '').concat(texts.join('\n'));


    const result = await chatOnce({
      modelProvider: actionData?.modelProvider!,
      modelId: actionData?.modelId!,
      content: prompt,
    });

    return {
      success: true,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      data: { texts: [result.data?.choices[0]?.message?.content || ''] },
    };
  }
}
