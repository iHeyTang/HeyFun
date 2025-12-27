/**
 * 向量库类型定义
 */

/**
 * 向量查询结果
 */
export interface VectorQueryResult {
  id: string;
  score?: number;
  metadata?: Record<string, any>;
}

/**
 * 向量库提供者接口
 * 所有向量库实现都需要实现此接口
 */
export interface VectorProvider {
  /**
   * 向量库类型标识
   */
  readonly type: string;

  /**
   * 向量库名称（用于区分多个实例）
   */
  readonly name: string;

  /**
   * 检查向量库是否可用
   */
  isAvailable(): boolean;

  /**
   * 查询相似向量
   * @param vector 查询向量
   * @param topK 返回最相似的前 K 个结果
   * @param filter 可选的过滤条件（元数据过滤）
   * @returns 查询结果列表
   */
  query(vector: number[], topK: number, filter?: Record<string, any>): Promise<VectorQueryResult[]>;

  /**
   * 插入或更新向量
   * @param id 向量 ID
   * @param vector 向量数据
   * @param metadata 元数据
   */
  upsert(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;

  /**
   * 批量插入或更新向量
   * @param items 向量项列表
   */
  upsertBatch(items: Array<{ id: string; vector: number[]; metadata?: Record<string, any> }>): Promise<void>;

  /**
   * 删除向量
   * @param id 向量 ID
   */
  delete(id: string): Promise<void>;

  /**
   * 批量删除向量
   * @param ids 向量 ID 列表
   */
  deleteBatch(ids: string[]): Promise<void>;
}

/**
 * 向量库配置
 */
export interface VectorProviderConfig {
  /**
   * 向量库类型（upstash, pinecone, weaviate, qdrant 等）
   */
  type: string;

  /**
   * 向量库名称（用于区分多个实例）
   */
  name: string;

  /**
   * 是否启用
   */
  enabled?: boolean;

  /**
   * 配置参数（根据不同的向量库类型有不同的参数）
   */
  config: Record<string, any>;
}

