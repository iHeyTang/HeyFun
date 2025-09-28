import { FlowGraphNode, NodeExecutor, NodeExecutorExecuteResult, NodeInput } from '../../types/nodes';

// 文本节点处理器
export abstract class BaseNodeProcessor<TActionData extends Record<string, any> = Record<string, any>> implements NodeExecutor {
  abstract execute(node: FlowGraphNode<TActionData>): Promise<NodeExecutorExecuteResult>;

  parseInputs(node: FlowGraphNode<TActionData>) {
    const input = (node.data.input || new Map()) as NodeInput;
    const images = Array.from(input.values())
      .map(item => item.images)
      .flat()
      .filter(item => !!item) as { url?: string; key?: string }[];
    const texts = Array.from(input.values())
      .map(item => item.texts)
      .flat()
      .filter(item => !!item) as string[];
    const videos = Array.from(input.values())
      .map(item => item.videos)
      .flat()
      .filter(item => !!item) as { url?: string; key?: string }[];

    return { images, texts, videos };
  }
}
