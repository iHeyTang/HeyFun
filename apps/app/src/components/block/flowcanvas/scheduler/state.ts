import { CanvasSchema } from '../types/canvas';
import { NodeExecutor, NodeStatus } from '../types/nodes';
import { ExecutionResult, NodeStatusData, OnNodeOutputChangeCallback, UnifiedScheduler } from './core';

// Context状态方法接口
export interface FlowGraphContextHandlers {
  setNodeStatus: (updates: Array<{ nodeId: string; status: NodeStatus; metadata?: Partial<NodeStatusData> }>) => void;
  getNodeStatus: (nodeId: string) => NodeStatusData | undefined;
  getAllStatuses: () => Map<string, NodeStatusData>;
  updateNodeMetadata: (nodeId: string, metadata: Partial<NodeStatusData>) => void;
  clearNodeStatus: (nodeId: string) => void;
  clearAllStatuses: () => void;
}

/**
 * 状态管理器
 * 内部维护状态，可选地同步到外部系统（如React Context、Redux等）
 * 核心是"内部状态 + 可选外部同步"，而不限定特定的外部系统类型
 */
export class ContextStateManager {
  // 内部状态缓存，确保同步访问
  private internalStatuses: Map<string, NodeStatusData> = new Map();
  private contextMethods?: FlowGraphContextHandlers;

  constructor(contextMethods?: FlowGraphContextHandlers) {
    this.contextMethods = contextMethods;
    // 如果提供了Context方法，初始化时同步Context状态到内部缓存
    if (this.contextMethods) {
      this.syncFromContext();
    }
  }

  /**
   * 创建调度器实例
   * @param schema 工作流定义
   * @param contextMethods 可选的外部状态同步方法（如React Context、Redux等）
   * @param onSchemaChange 可选的schema变化回调
   */
  static create(schema: CanvasSchema, contextMethods?: FlowGraphContextHandlers, onSchemaChange?: OnNodeOutputChangeCallback): UnifiedScheduler {
    const stateManager = new ContextStateManager(contextMethods);
    return new UnifiedScheduler(schema, stateManager, onSchemaChange);
  }

  /**
   * 运行工作流的便捷函数
   * @param schema 工作流定义
   * @param contextMethods 可选的外部状态同步方法
   * @param triggerNodeId 可选的触发节点ID
   * @param options 可选的配置项
   */
  static async runWorkflow(
    schema: CanvasSchema,
    contextMethods?: FlowGraphContextHandlers,
    triggerNodeId?: string,
    options?: { nodeExecutors?: Map<string, NodeExecutor>; onSchemaChange?: OnNodeOutputChangeCallback },
  ): Promise<ExecutionResult> {
    const scheduler = ContextStateManager.create(schema, contextMethods, options?.onSchemaChange);

    if (options?.nodeExecutors) {
      scheduler.registerNodeExecutors(options.nodeExecutors);
    }

    return await scheduler.run(triggerNodeId);
  }

  /**
   * 从Context同步状态到内部缓存（仅在有Context时）
   */
  private syncFromContext(): void {
    if (this.contextMethods) {
      const contextStatuses = this.contextMethods.getAllStatuses();
      this.internalStatuses = new Map(contextStatuses);
    }
  }

  getNodeStatus(nodeId: string): NodeStatusData | undefined {
    // 优先使用内部缓存的状态
    const internalResult = this.internalStatuses.get(nodeId);
    const contextResult = this.contextMethods?.getNodeStatus(nodeId);

    // 如果内部缓存有状态，使用内部缓存；否则使用Context状态
    return internalResult || contextResult;
  }

  setNodeStatus(nodeId: string, status: NodeStatus, metadata?: Partial<NodeStatusData>): void {
    // 构建完整的状态数据
    const existingStatus = this.internalStatuses.get(nodeId);
    const newStatusData: NodeStatusData = {
      status,
      auto: metadata?.auto ?? existingStatus?.auto ?? true,
      lastUpdated: new Date(),
      executionTime: metadata?.executionTime ?? existingStatus?.executionTime,
      error: metadata?.error ?? (status === NodeStatus.FAILED ? existingStatus?.error : undefined),
      metadata: { ...existingStatus?.metadata, ...metadata?.metadata },
    };

    // 立即更新内部缓存
    this.internalStatuses.set(nodeId, newStatusData);

    // 可选地异步更新Context（不阻塞执行）
    if (this.contextMethods) {
      this.contextMethods.setNodeStatus([{ nodeId, status, metadata }]);
    }
  }

  getAllStatuses(): Map<string, NodeStatusData> {
    // 返回内部缓存的状态
    return new Map(this.internalStatuses);
  }

  updateNodeMetadata(nodeId: string, metadata: Partial<NodeStatusData>): void {
    const existingStatus = this.internalStatuses.get(nodeId);
    if (existingStatus) {
      const updatedStatus = { ...existingStatus, ...metadata, lastUpdated: new Date() };
      this.internalStatuses.set(nodeId, updatedStatus);
    }

    // 可选地更新Context
    if (this.contextMethods) {
      this.contextMethods.updateNodeMetadata(nodeId, metadata);
    }
  }

  reset(): void {
    this.internalStatuses.clear();

    // 可选地清空Context
    if (this.contextMethods) {
      this.contextMethods.clearAllStatuses();
    }
  }
}
