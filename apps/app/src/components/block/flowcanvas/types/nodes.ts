// 导入工作流API中的状态枚举和类型，保持一致性
import { Node } from '@xyflow/react';
import { WorkflowContext } from '../scheduler/core';

export type NodeType = 'image' | 'video' | 'audio' | 'music' | 'text' | 'default' | 'processor';

/**
 * 节点输出接口
 */
export interface NodeOutput {
  images?: { list: string[]; selected: string };
  videos?: { list: string[]; selected: string };
  audios?: { list: string[]; selected: string };
  musics?: { list: string[]; selected: string };
  texts?: { list: string[]; selected: string };
}

/**
 * 节点输入接口
 */
export type NodeInput = Map<string, NodeOutput>;

/**
 * 增强的节点数据接口，支持输入输出
 * 注意：status现在由Context管理，不再存储在节点数据中
 */
export interface NodeData<TActionData extends Record<string, any> = Record<string, any>> extends Record<string, any> {
  label?: string;
  description?: string;
  // 节点执行相关
  auto?: boolean; // 是否自动执行

  // 数据
  input?: NodeInput; // 节点的输入
  output?: NodeOutput; // 节点的输出
  actionData?: TActionData; // 节点自身的数据
}

export type FlowGraphNode<TActionData extends Record<string, any> = Record<string, any>> = Node<NodeData<TActionData>>;

/**
 * 工作流节点状态枚举
 */
export enum NodeStatus {
  IDLE = 'idle', // 空闲状态
  PENDING = 'pending', // 等待前置节点完成
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 失败
  PAUSED = 'paused', // 暂停（需要手动触发）
}

/**
 * 工作流节点运行时状态
 */
export interface WorkflowNodeState {
  id: string;
  status: NodeStatus;
  auto: boolean; // 是否自动触发
  error?: string; // 错误信息
  startTime?: Date; // 开始时间
  endTime?: Date; // 结束时间
  result?: any; // 执行结果
}

export interface NodeExecutorExecuteResult {
  success: boolean;
  timestamp: Date;
  executionTime?: number;
  error?: string;
  data?: {
    images?: NonNullable<NodeOutput['images']>['list'];
    videos?: NonNullable<NodeOutput['videos']>['list'];
    audios?: NonNullable<NodeOutput['audios']>['list'];
    musics?: NonNullable<NodeOutput['musics']>['list'];
    texts?: NonNullable<NodeOutput['texts']>['list'];
  };
}

export type BaseNodeActionData<T extends Record<string, any> = Record<string, any>> = {
  input: {
    texts: { nodeId: string; texts?: NodeOutput['texts'] }[];
    images: { nodeId: string; images?: NodeOutput['images'] }[];
    videos: { nodeId: string; videos?: NodeOutput['videos'] }[];
    audios: { nodeId: string; audios?: NodeOutput['audios'] }[];
    musics: { nodeId: string; musics?: NodeOutput['musics'] }[];
  };
  actionData?: T;
};

/**
 * 节点执行器接口
 * 支持两种调用方式：传入处理好的数据或传入上下文自己提取数据
 */
export interface NodeExecutor<TActionData extends Record<string, any> = Record<string, any>> {
  /**
   * 执行节点逻辑
   * @param dataOrNodeId - 如果是NodeRunData则直接处理，如果是string则作为nodeId使用
   * @param context - 当第一个参数是nodeId时必须提供工作流上下文
   */
  execute(data: BaseNodeActionData<TActionData>, context?: WorkflowContext): Promise<NodeExecutorExecuteResult>;
}
