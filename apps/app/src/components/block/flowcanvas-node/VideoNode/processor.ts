import { BaseNodeProcessor, FlowGraphNode, NodeExecutorExecuteResult } from '@/components/block/flowcanvas';

export type VideoNodeActionData = {
  prompt?: string;
  selectedModel?: string;
};

// 视频节点处理器
export class VideoNodeProcessor extends BaseNodeProcessor<VideoNodeActionData> {
  async execute(node: FlowGraphNode<VideoNodeActionData>): Promise<NodeExecutorExecuteResult> {
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
      error: 'Failed to generate video',
      data: { images: [] },
    };
  }
}
