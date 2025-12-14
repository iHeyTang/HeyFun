/**
 * 云端 Snippets 服务
 *
 * 从官方接口拉取云端 snippets（片段市场）
 * 当前为 mock 实现，方便日后接入实际接口
 */

import { SnippetRecord } from './snippet-store';
import { PromptFragmentConfig } from './types';

export interface CloudSnippetResponse {
  snippets: CloudSnippet[];
  total: number;
  version: string;
}

export interface CloudSnippet {
  id: string;
  name: string;
  description: string;
  content: string;
  version: string;
  author: string;
  category: PromptFragmentConfig['category'];
  priority: number;
  section?: string;
  tags?: string[];
  downloads?: number;
  rating?: number;
  updated_at: number;
}

/**
 * 云端 Snippets 服务
 */
export class CloudSnippetService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // 如果提供了 baseUrl，使用实际接口；否则使用 mock
    this.baseUrl = baseUrl || '';
  }

  /**
   * 获取云端 snippets 列表
   * @param options 查询选项
   */
  async fetchCloudSnippets(options?: {
    category?: PromptFragmentConfig['category'];
    limit?: number;
    offset?: number;
  }): Promise<CloudSnippetResponse> {
    if (this.baseUrl) {
      // 实际接口调用
      return this.fetchFromAPI(options);
    } else {
      // Mock 数据
      return this.fetchMockData(options);
    }
  }

  /**
   * 从实际 API 获取数据
   */
  private async fetchFromAPI(options?: {
    category?: PromptFragmentConfig['category'];
    limit?: number;
    offset?: number;
  }): Promise<CloudSnippetResponse> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `${this.baseUrl}/api/snippets?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`获取云端 snippets 失败: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Mock 数据
   */
  private async fetchMockData(options?: {
    category?: PromptFragmentConfig['category'];
    limit?: number;
    offset?: number;
  }): Promise<CloudSnippetResponse> {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 500));

    const allMockSnippets: CloudSnippet[] = [
      {
        id: 'cloud-ai-researcher',
        name: 'AI 研究助手',
        description: '提供 AI 研究相关的专业指导',
        content: `# AI 研究助手

## 研究原则
- 基于最新论文和研究成果
- 注重实验验证和可复现性
- 关注伦理和社会影响

## 研究流程
1. 问题定义
2. 文献调研
3. 方法设计
4. 实验验证
5. 结果分析`,
        version: '1.0.0',
        author: 'Okey Team',
        category: 'guideline',
        priority: 60,
        section: '🔬 AI 研究',
        tags: ['ai', 'research', 'academic'],
        downloads: 1234,
        rating: 4.8,
        updated_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'cloud-data-analyst',
        name: '数据分析专家',
        description: '专业的数据分析和可视化指导',
        content: `# 数据分析专家

## 分析原则
- 数据质量优先
- 可视化清晰直观
- 结论基于数据证据

## 分析流程
1. 数据收集和清洗
2. 探索性数据分析
3. 统计分析和建模
4. 结果可视化和解释`,
        version: '1.0.0',
        author: 'Okey Team',
        category: 'guideline',
        priority: 55,
        section: '📊 数据分析',
        tags: ['data', 'analysis', 'visualization'],
        downloads: 987,
        rating: 4.7,
        updated_at: Date.now() - 14 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'cloud-product-manager',
        name: '产品经理助手',
        description: '产品规划和管理的专业指导',
        content: `# 产品经理助手

## 产品原则
- 用户价值优先
- 数据驱动决策
- 快速迭代验证

## 工作流程
1. 需求分析
2. 产品规划
3. 原型设计
4. 开发协作
5. 上线和迭代`,
        version: '1.0.0',
        author: 'Okey Team',
        category: 'guideline',
        priority: 52,
        section: '📱 产品管理',
        tags: ['product', 'management', 'strategy'],
        downloads: 756,
        rating: 4.6,
        updated_at: Date.now() - 21 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'cloud-marketing-expert',
        name: '营销专家',
        description: '营销策略和内容创作指导',
        content: `# 营销专家

## 营销原则
- 目标受众明确
- 内容有价值
- 多渠道整合

## 营销策略
1. 市场调研
2. 目标定位
3. 内容策划
4. 渠道选择
5. 效果评估`,
        version: '1.0.0',
        author: 'Okey Team',
        category: 'guideline',
        priority: 48,
        section: '📢 营销推广',
        tags: ['marketing', 'content', 'strategy'],
        downloads: 543,
        rating: 4.5,
        updated_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
      },
    ];

    // 过滤
    let filtered = allMockSnippets;
    if (options?.category) {
      filtered = filtered.filter((s) => s.category === options.category);
    }

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      snippets: paginated,
      total: filtered.length,
      version: '1.0.0',
    };
  }

  /**
   * 将 CloudSnippet 转换为 SnippetRecord
   */
  convertToRecord(cloudSnippet: CloudSnippet): SnippetRecord {
    return {
      id: cloudSnippet.id,
      name: cloudSnippet.name,
      description: cloudSnippet.description,
      enabled: false, // 云端片段默认不启用，需要同步到本地
      content: cloudSnippet.content,
      version: cloudSnippet.version,
      author: cloudSnippet.author,
      category: cloudSnippet.category,
      priority: cloudSnippet.priority,
      section: cloudSnippet.section,
      source: 'cloud',
      cloud_id: cloudSnippet.id,
      created_at: cloudSnippet.updated_at,
      updated_at: cloudSnippet.updated_at,
    };
  }

  /**
   * 批量转换
   */
  convertManyToRecords(cloudSnippets: CloudSnippet[]): SnippetRecord[] {
    return cloudSnippets.map((snippet) => this.convertToRecord(snippet));
  }
}

// 导出单例
export const cloudSnippetService = new CloudSnippetService();
