import { CanvasSchema } from '../types/canvas';
import { FlowGraphNode, NodeData, NodeExecutor, NodeExecutorExecuteResult, NodeOutput, NodeStatus, WorkflowNodeState } from '../types/nodes';
import { ContextStateManager, FlowGraphContextHandlers } from './state';

// 节点状态接口
export interface NodeStatusData {
  status: NodeStatus;
  auto?: boolean;
  lastUpdated?: Date;
  executionTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 工作流执行上下文
 */
export interface WorkflowContext {
  nodes: Map<string, WorkflowNodeState>;
  schema: CanvasSchema;
  dependencies: Map<string, string[]>; // 节点ID -> 前置节点ID列表
}

/**
 * 执行结果接口
 */
export interface ExecutionResult {
  success: boolean;
  nodeStates: Map<string, NodeStatusData>;
  errors: Array<{ nodeId: string; error: string }>;
}

/**
 * 节点执行器注册表 (内部类)
 * 管理所有节点类型的执行器
 */
class NodeExecutorRegistry {
  private executors: Map<string, NodeExecutor> = new Map();

  registerExecutor(nodeType: string, executor: NodeExecutor): void {
    this.executors.set(nodeType, executor);
  }

  getExecutor(nodeType: string): NodeExecutor | undefined {
    return this.executors.get(nodeType);
  }

  registerExecutors(executors: Map<string, NodeExecutor>): void {
    executors.forEach((executor, nodeType) => {
      this.registerExecutor(nodeType, executor);
    });
  }
}

/**
 * 通用节点执行器 (内部类)
 * 根据节点类型自动选择执行器，支持两种调用方式
 */
class UniversalNodeExecutor implements NodeExecutor {
  private executorRegistry: NodeExecutorRegistry;

  constructor(executorRegistry: NodeExecutorRegistry) {
    this.executorRegistry = executorRegistry;
  }

  async execute(node: FlowGraphNode, context: WorkflowContext): Promise<NodeExecutorExecuteResult> {
    const nodeType = node.type;
    const executor = this.executorRegistry.getExecutor(nodeType || 'default');

    if (!executor) {
      throw new Error(`找不到节点类型 "${nodeType}" 的执行器`);
    }

    // 收集前置节点的输入数据
    const inputs = this.collectNodeInputs(node.id, context);

    // 创建包含输入数据的节点副本
    const nodeWithInputs = { ...node, data: { ...node.data, input: inputs } };

    console.log(`UniversalNodeExecutor execute - 传递给执行器的节点数据:`, {
      nodeId: node.id,
      nodeType: node.type,
      inputSize: inputs.size,
      inputData: Array.from(inputs.entries()),
      fullNodeData: nodeWithInputs.data,
    });

    return await executor.execute(nodeWithInputs);
  }

  /**
   * 从工作流上下文构建节点运行数据
   */
  private buildNodeRunData(nodeId: string, context: WorkflowContext): FlowGraphNode {
    const node = context.schema.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`找不到节点: ${nodeId}`);
    }

    return node;
  }

  /**
   * 收集节点的输入数据
   */
  private collectNodeInputs(nodeId: string, context: WorkflowContext): Map<string, NodeOutput> {
    console.log(`UnifiedScheduler collectNodeInputs - 开始收集节点 ${nodeId} 的输入数据`);

    const inputsMap = new Map<string, NodeOutput>();

    // 找到所有指向当前节点的边
    const incomingEdges = context.schema.edges.filter(edge => edge.target === nodeId);
    console.log(`UnifiedScheduler collectNodeInputs - 找到 ${incomingEdges.length} 条输入边:`, incomingEdges);

    // 收集前置节点的输出
    for (const edge of incomingEdges) {
      const sourceNodeState = context.nodes.get(edge.source);
      console.log(`UnifiedScheduler collectNodeInputs - 源节点 ${edge.source} 状态:`, sourceNodeState);

      if (sourceNodeState?.result?.data) {
        const sourceOutput = sourceNodeState.result.data;
        console.log(`UnifiedScheduler collectNodeInputs - 源节点 ${edge.source} 输出数据:`, sourceOutput);

        // 将前置节点的输出添加到输入映射中，使用边的源节点ID作为key
        inputsMap.set(edge.source, sourceOutput);

        console.log(`UnifiedScheduler collectNodeInputs - 已将节点 ${edge.source} 的输出添加到输入映射`);
      } else {
        console.warn(`UnifiedScheduler collectNodeInputs - 源节点 ${edge.source} 没有可用的输出数据`);
      }
    }

    console.log(`UnifiedScheduler collectNodeInputs - 节点 ${nodeId} 最终收集到的输入数据映射:`, inputsMap);
    return inputsMap;
  }
}

/**
 * Schema变化回调函数类型
 */
export type OnNodeOutputChangeCallback = (nodeId: string, output: NodeData['output']) => void;

/**
 * 统一工作流调度器
 * 核心调度逻辑，支持不同的状态管理策略
 */
export class UnifiedScheduler {
  private schema: CanvasSchema;
  private stateManager: ContextStateManager;
  private nodeExecutors: Map<string, NodeExecutor> = new Map();
  private dependencies: Map<string, string[]> = new Map();
  private executorRegistry: NodeExecutorRegistry = new NodeExecutorRegistry();
  private onNodeOutputChange?: OnNodeOutputChangeCallback;

  constructor(schema: CanvasSchema, stateManager: ContextStateManager, onNodeOutputChange?: OnNodeOutputChangeCallback) {
    this.schema = schema;
    this.stateManager = stateManager;
    this.onNodeOutputChange = onNodeOutputChange;

    this.buildDependencyGraph();
    this.initializeNodes();
    this.setupAutoExecutors();
  }

  /**
   * 创建调度器实例
   * @param schema 工作流定义
   * @param contextMethods 可选的外部状态同步方法（如React Context、Redux等）
   * @param onNodeOutputChange 可选的schema变化回调
   */
  static create(schema: CanvasSchema, contextMethods?: FlowGraphContextHandlers, onNodeOutputChange?: OnNodeOutputChangeCallback): UnifiedScheduler {
    const stateManager = new ContextStateManager(contextMethods);
    return new UnifiedScheduler(schema, stateManager, onNodeOutputChange);
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
    triggerNodeId?: string,
    contextMethods?: FlowGraphContextHandlers,
    options?: { nodeExecutors?: Map<string, NodeExecutor>; onNodeOutputChange?: OnNodeOutputChangeCallback },
  ): Promise<ExecutionResult> {
    const scheduler = UnifiedScheduler.create(schema, contextMethods, options?.onNodeOutputChange);

    if (options?.nodeExecutors) {
      scheduler.registerNodeExecutors(options.nodeExecutors);
    }

    return await scheduler.run(triggerNodeId);
  }

  /**
   * 设置自动执行器
   * 为所有节点创建统一的执行器
   */
  private setupAutoExecutors(): void {
    const universalExecutor = new UniversalNodeExecutor(this.executorRegistry);

    // 为每个节点创建相同的通用执行器实例
    this.schema.nodes.forEach(node => {
      this.nodeExecutors.set(node.id, universalExecutor);
    });
  }

  /**
   * 构建依赖关系图
   */
  private buildDependencyGraph(): void {
    this.dependencies.clear();

    // 创建节点ID集合以便快速查找
    const nodeIds = new Set(this.schema.nodes.map(node => node.id));

    // 初始化所有节点的依赖数组
    this.schema.nodes.forEach(node => {
      this.dependencies.set(node.id, []);
    });

    // 根据边构建依赖关系，过滤掉无效的边
    this.schema.edges.forEach(edge => {
      // 验证边所引用的节点是否存在
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        console.warn(
          `UnifiedScheduler buildDependencyGraph - 发现无效边: ${edge.source} -> ${edge.target}。源节点存在: ${nodeIds.has(edge.source)}, 目标节点存在: ${nodeIds.has(edge.target)}`,
        );
        return; // 跳过无效的边
      }

      const targetDeps = this.dependencies.get(edge.target) || [];
      targetDeps.push(edge.source);
      this.dependencies.set(edge.target, targetDeps);
    });

    console.log('UnifiedScheduler buildDependencyGraph - 构建完成的依赖关系图:', this.dependencies);
  }

  /**
   * 初始化所有节点状态
   */
  private initializeNodes(): void {
    console.log('UnifiedScheduler initializeNodes - 开始初始化节点状态');
    this.schema.nodes.forEach(node => {
      const auto = node.data?.auto !== false; // 默认为true
      const existingStatus = this.stateManager.getNodeStatus(node.id);

      console.log(`初始化节点 ${node.id}: existingStatus=`, existingStatus);

      // 强制初始化所有节点状态，确保状态一致性
      console.log(`强制设置节点 ${node.id} 状态为 IDLE`);
      this.stateManager.setNodeStatus(node.id, NodeStatus.IDLE, { auto });
    });

    // 验证初始化结果
    const allStatuses = this.stateManager.getAllStatuses();
    console.log('初始化完成后的所有节点状态:', allStatuses);
  }

  /**
   * 注册节点执行器（按类型注册）
   * 为指定节点类型注册执行器，所有该类型的节点都会使用此执行器
   */
  registerNodeExecutor(nodeType: string, executor: NodeExecutor): void {
    this.executorRegistry.registerExecutor(nodeType, executor);
  }

  /**
   * 批量注册节点执行器
   */
  registerNodeExecutors(executors: Map<string, NodeExecutor>): void {
    this.executorRegistry.registerExecutors(executors);
  }

  /**
   * 注册特定节点实例的执行器（高级用法）
   * 直接为特定节点ID注册执行器，会覆盖类型执行器
   */
  registerNodeInstanceExecutor(nodeId: string, executor: NodeExecutor): void {
    this.nodeExecutors.set(nodeId, executor);
  }

  /**
   * 批量注册节点实例执行器
   */
  registerNodeInstanceExecutors(executors: Map<string, NodeExecutor>): void {
    executors.forEach((executor, nodeId) => {
      this.registerNodeInstanceExecutor(nodeId, executor);
    });
  }

  /**
   * 获取节点的前置依赖
   */
  private getNodeDependencies(nodeId: string): string[] {
    return this.dependencies.get(nodeId) || [];
  }

  /**
   * 检查节点是否可以执行
   */
  private canNodeExecute(nodeId: string): boolean {
    const nodeStatus = this.stateManager.getNodeStatus(nodeId);
    const currentStatus = nodeStatus?.status ?? NodeStatus.IDLE;

    // 如果已经在处理中、已完成或失败，不能再次执行
    if ([NodeStatus.PROCESSING, NodeStatus.COMPLETED, NodeStatus.FAILED].includes(currentStatus)) {
      return false;
    }

    // 检查所有前置节点是否已完成
    const dependencies = this.getNodeDependencies(nodeId);
    return dependencies.every(depId => {
      const depStatus = this.stateManager.getNodeStatus(depId);
      console.log('UnifiedScheduler canNodeExecute depStatus', depId, depStatus);
      return depStatus?.status === NodeStatus.COMPLETED;
    });
  }

  /**
   * 执行单个节点
   */
  private async executeNode(nodeId: string): Promise<void> {
    console.log('UnifiedScheduler executeNode', nodeId);
    const executor = this.nodeExecutors.get(nodeId);
    if (!executor) {
      throw new Error(`No executor found for node ${nodeId}`);
    }

    try {
      // 更新状态为处理中
      this.stateManager.setNodeStatus(nodeId, NodeStatus.PROCESSING, {
        executionTime: undefined,
        error: undefined,
      });

      const startTime = Date.now();

      // 创建执行上下文
      const context = this.createWorkflowContext();

      // 执行节点
      const node = this.schema.nodes.find(n => n.id === nodeId)!;
      console.log('UnifiedScheduler executeNode node', node);
      const result = await executor.execute(node, context);
      console.log('UnifiedScheduler executeNode result', nodeId, result);

      const executionTime = Date.now() - startTime;

      // 更新节点的output数据到schema中
      if (result.success && result.data) {
        const nodeIndex = this.schema.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex !== -1) {
          const currentNode = this.schema.nodes[nodeIndex];
          if (currentNode) {
            this.schema.nodes[nodeIndex] = { ...currentNode, data: { ...currentNode.data, output: result.data } };

            console.log(`UnifiedScheduler executeNode - 已更新节点 ${nodeId} 的输出数据到schema:`, result.data);

            // 立即触发schema变化回调，确保UI能够及时更新
            this.onNodeOutputChange?.(nodeId, result.data);

            // 添加微小延迟确保React状态更新完成
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }

      // 更新状态为完成，同时保存执行结果到metadata中
      this.stateManager.setNodeStatus(nodeId, NodeStatus.COMPLETED, {
        executionTime,
        metadata: {
          result,
          // 确保结果数据也保存在状态中，以便后续节点能够访问
          outputData: result.data,
        },
      });

      console.log(`UnifiedScheduler executeNode - 已更新节点 ${nodeId} 的状态为COMPLETED，执行结果:`, {
        executionTime,
        resultData: result.data,
        success: result.success,
      });

      console.log(`节点 ${nodeId} 在 ${executionTime}ms 内完成执行`);

      // 等待React状态更新完成
      //   await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      const executionTime = Date.now() - Date.now();

      // 更新状态为失败
      this.stateManager.setNodeStatus(nodeId, NodeStatus.FAILED, {
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      console.error(`节点 ${nodeId} 执行失败:`, error);
      throw error;
    }
  }

  /**
   * 创建工作流上下文
   */
  private createWorkflowContext(): { nodes: Map<string, WorkflowNodeState>; schema: CanvasSchema; dependencies: Map<string, string[]> } {
    const nodes = new Map<string, WorkflowNodeState>();

    // 转换状态格式
    this.stateManager.getAllStatuses().forEach((statusData, nodeId) => {
      // 从节点的output数据或状态元数据中获取结果
      const nodeInSchema = this.schema.nodes.find(n => n.id === nodeId);
      const outputData = nodeInSchema?.data?.output;
      const resultFromMetadata = statusData.metadata?.result;
      const outputDataFromMetadata = statusData.metadata?.outputData;

      // 优先使用schema中的output数据，其次使用metadata中的outputData或result.data
      const resultData = outputData || outputDataFromMetadata || resultFromMetadata?.data;

      console.log(`UnifiedScheduler createWorkflowContext - 节点 ${nodeId} 数据来源:`, {
        outputData,
        outputDataFromMetadata,
        resultFromMetadata: resultFromMetadata?.data,
        finalResultData: resultData,
      });

      nodes.set(nodeId, {
        id: nodeId,
        status: statusData.status,
        auto: statusData.auto ?? true,
        error: statusData.error,
        startTime: statusData.lastUpdated,
        result: resultData
          ? {
              success: true,
              timestamp: statusData.lastUpdated || new Date(),
              executionTime: statusData.executionTime,
              data: resultData,
            }
          : resultFromMetadata,
      });
    });

    console.log('UnifiedScheduler createWorkflowContext - 创建的上下文节点状态:', nodes);
    return {
      nodes,
      schema: this.schema,
      dependencies: this.dependencies,
    };
  }

  /**
   * 手动触发指定节点
   */
  async triggerNode(nodeId: string): Promise<void> {
    if (!this.canNodeExecute(nodeId)) {
      throw new Error(`节点 ${nodeId} 无法执行。请检查依赖关系和当前状态。`);
    }

    await this.executeNode(nodeId);

    // 执行完成后，尝试自动调度依赖于此节点的其他节点
    await this.scheduleDownstreamNodes(nodeId);
  }

  /**
   * 调度下游节点
   */
  private async scheduleDownstreamNodes(completedNodeId: string): Promise<void> {
    console.log(`开始调度下游节点，已完成节点: ${completedNodeId}`);

    // 验证已完成节点的状态
    const completedNodeStatus = this.stateManager.getNodeStatus(completedNodeId);
    console.log(`验证节点 ${completedNodeId} 状态:`, completedNodeStatus);

    // 找到所有依赖于已完成节点的节点
    const downstreamNodes: string[] = [];
    console.log('UnifiedScheduler scheduleDownstreamNodes', completedNodeId, this.dependencies);

    this.dependencies.forEach((deps, nodeId) => {
      if (deps.includes(completedNodeId)) {
        downstreamNodes.push(nodeId);
      }
    });
    console.log('UnifiedScheduler scheduleDownstreamNodes downstreamNodes', downstreamNodes);
    // 并行检查和执行可执行的下游节点
    const executableNodes = downstreamNodes.filter(nodeId => {
      const nodeStatus = this.stateManager.getNodeStatus(nodeId);
      return (nodeStatus?.auto ?? true) && this.canNodeExecute(nodeId);
    });
    console.log('UnifiedScheduler scheduleDownstreamNodes executableNodes', executableNodes);

    const executePromises = executableNodes.map(nodeId => this.executeNode(nodeId).then(() => this.scheduleDownstreamNodes(nodeId)));
    await Promise.allSettled(executePromises);
  }

  /**
   * 运行整个工作流
   */
  async run(triggerNodeId?: string): Promise<ExecutionResult> {
    try {
      if (triggerNodeId) {
        // 如果指定了触发节点，先执行该节点
        await this.triggerNode(triggerNodeId);
      } else {
        // 否则找到所有没有依赖的节点（入口节点）并执行
        const entryNodes = this.schema.nodes
          .filter(node => {
            const deps = this.getNodeDependencies(node.id);
            const nodeStatus = this.stateManager.getNodeStatus(node.id);
            return deps.length === 0 && (nodeStatus?.auto ?? true) && this.canNodeExecute(node.id);
          })
          .map(node => node.id);

        // 并行执行所有入口节点
        const executePromises = entryNodes.map(nodeId => this.executeNode(nodeId).then(() => this.scheduleDownstreamNodes(nodeId)));

        await Promise.allSettled(executePromises);
      }

      const finalStates = this.stateManager.getAllStatuses();

      // 收集执行过程中的错误
      const errors: Array<{ nodeId: string; error: string }> = [];
      finalStates.forEach((statusData, nodeId) => {
        if (statusData.status === NodeStatus.FAILED && statusData.error) {
          errors.push({ nodeId, error: statusData.error });
        }
      });

      return {
        success: errors.length === 0,
        nodeStates: finalStates,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        nodeStates: this.stateManager.getAllStatuses(),
        errors: [{ nodeId: 'unknown', error: error instanceof Error ? error.message : String(error) }],
      };
    }
  }

  /**
   * 获取节点状态
   */
  getNodeStatus(nodeId: string): NodeStatusData | undefined {
    return this.stateManager.getNodeStatus(nodeId);
  }

  /**
   * 获取所有节点状态
   */
  getAllNodeStates(): Map<string, NodeStatusData> {
    return this.stateManager.getAllStatuses();
  }

  /**
   * 重置所有节点状态
   */
  reset(): void {
    this.schema.nodes.forEach(node => {
      this.stateManager.setNodeStatus(node.id, NodeStatus.IDLE, {
        auto: node.data?.auto !== false,
        error: undefined,
        executionTime: undefined,
        metadata: {},
      });
    });
  }

  /**
   * 获取依赖关系图
   */
  getDependencies(): Map<string, string[]> {
    return new Map(this.dependencies);
  }

  /**
   * 获取可执行的节点列表
   */
  getExecutableNodes(): string[] {
    return this.schema.nodes.map(node => node.id).filter(nodeId => this.canNodeExecute(nodeId));
  }
}
