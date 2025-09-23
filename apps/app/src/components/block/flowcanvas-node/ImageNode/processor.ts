import { submitGenerationTask } from '@/actions/paintboard';
import { BaseNodeProcessor, FlowGraphNode, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type ImageNodeActionData = {
  prompt?: string;
  selectedModel?: string;
};

// 图片节点处理器
export class ImageNodeProcessor extends BaseNodeProcessor<ImageNodeActionData> {
  async execute(node: FlowGraphNode<ImageNodeActionData>): Promise<NodeExecutorExecuteResult> {
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

    return {
      success: false,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      error: 'Failed to generate image',
      data: { images: [] },
    };
  }
}
