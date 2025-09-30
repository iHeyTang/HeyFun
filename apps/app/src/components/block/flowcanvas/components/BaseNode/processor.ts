import { BaseNodeActionData, NodeExecutor, NodeExecutorExecuteResult } from '../../types/nodes';

// 文本节点处理器
export abstract class BaseNodeProcessor<TActionData extends Record<string, any> = Record<string, any>> implements NodeExecutor {
  abstract execute(data: BaseNodeActionData<TActionData>): Promise<NodeExecutorExecuteResult>;
}
