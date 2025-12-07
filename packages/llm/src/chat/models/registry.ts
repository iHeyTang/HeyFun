import { ModelInfo, ModelFilter } from './types';

/**
 * ModelRegistry - 模型查询和过滤工具类
 * 注意：模型信息现在存储在数据库中，不再通过注册表管理
 * 此类仅提供查询和过滤功能
 */
export class ModelRegistry {
  /**
   * 从模型列表中获取指定模型
   */
  static getModel(models: ModelInfo[], modelId: string): ModelInfo | null {
    return models.find(m => m.id === modelId) || null;
  }

  /**
   * 检查模型列表中是否包含指定模型
   */
  static hasModel(models: ModelInfo[], modelId: string): boolean {
    return models.some(m => m.id === modelId);
  }

  /**
   * 过滤模型列表
   */
  static filterModels(models: ModelInfo[], filter: ModelFilter): ModelInfo[] {
    let filtered = [...models];

    if (filter.provider) filtered = filtered.filter(m => m.provider === filter.provider);
    if (filter.family) filtered = filtered.filter(m => m.family === filter.family);
    if (filter.type) filtered = filtered.filter(m => m.type === filter.type);
    if (filter.supportsStreaming !== undefined) {
      filtered = filtered.filter(m => m.supportsStreaming === filter.supportsStreaming);
    }
    if (filter.supportsFunctionCalling !== undefined) {
      filtered = filtered.filter(m => m.supportsFunctionCalling === filter.supportsFunctionCalling);
    }
    if (filter.supportsVision !== undefined) {
      filtered = filtered.filter(m => m.supportsVision === filter.supportsVision);
    }
    if (filter.maxPrice !== undefined) {
      filtered = filtered.filter(m => {
        const inputPrice = m.pricing?.input ? Number(m.pricing.input) : 0;
        const outputPrice = m.pricing?.output ? Number(m.pricing.output) : 0;
        return Math.max(inputPrice, outputPrice) <= filter.maxPrice!;
      });
    }
    if (filter.minContextLength !== undefined) {
      filtered = filtered.filter(m => (m.contextLength || 0) >= filter.minContextLength!);
    }

    return filtered;
  }

  /**
   * 按家族分组模型
   */
  static groupByFamily(models: ModelInfo[]): Map<string, ModelInfo[]> {
    const groups = new Map<string, ModelInfo[]>();
    models.forEach(model => {
      const family = model.family || 'other';
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family)!.push(model);
    });
    return groups;
  }

  /**
   * 按提供商分组模型
   */
  static groupByProvider(models: ModelInfo[]): Map<string, ModelInfo[]> {
    const groups = new Map<string, ModelInfo[]>();
    models.forEach(model => {
      if (!groups.has(model.provider)) groups.set(model.provider, []);
      groups.get(model.provider)!.push(model);
    });
    return groups;
  }

  /**
   * 获取免费模型
   */
  static getFreeModels(models: ModelInfo[]): ModelInfo[] {
    return models.filter(m => {
      const inputPrice = m.pricing?.input ? Number(m.pricing.input) : 0;
      const outputPrice = m.pricing?.output ? Number(m.pricing.output) : 0;
      return inputPrice === 0 && outputPrice === 0;
    });
  }

  /**
   * 获取具有特定能力的模型
   */
  static getModelsWithCapability(models: ModelInfo[], capability: string): ModelInfo[] {
    return models.filter(m => {
      switch (capability) {
        case 'streaming':
          return m.supportsStreaming;
        case 'tools':
        case 'functionCalling':
          return m.supportsFunctionCalling;
        case 'vision':
          return m.supportsVision;
        default:
          return false;
      }
    });
  }

  /**
   * 搜索模型
   */
  static searchModels(models: ModelInfo[], query: string): ModelInfo[] {
    const lowerQuery = query.toLowerCase();
    return models.filter(
      m =>
        m.id.toLowerCase().includes(lowerQuery) ||
        m.name.toLowerCase().includes(lowerQuery) ||
        (m.description && m.description.toLowerCase().includes(lowerQuery)),
    );
  }
}
