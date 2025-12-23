/**
 * 搜索结果项
 */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  [key: string]: any; // 允许提供者添加额外字段
}

/**
 * 搜索参数
 */
export interface SearchParams {
  query: string;
  maxResults: number;
  searchType?: 'general' | 'news' | 'images';
  engine?: string; // 指定使用的搜索引擎提供者：'bocha', 'serpapi', 'duckduckgo'，或 'auto'（自动选择）
}

/**
 * 搜索提供者配置
 */
export interface SearchProviderConfig {
  enabled: boolean;
  priority: number; // 优先级，数字越小优先级越高
  apiKey?: string;
  [key: string]: any; // 允许提供者特定的配置
}

/**
 * 搜索提供者接口
 */
export interface SearchProvider {
  /**
   * 提供者名称
   */
  name: string;

  /**
   * 检查是否可用（如是否配置了必要的API key）
   */
  isAvailable(): boolean;

  /**
   * 执行搜索
   */
  search(params: SearchParams): Promise<SearchResult[]>;

  /**
   * 获取提供者配置
   */
  getConfig(): SearchProviderConfig;

  /**
   * 更新提供者配置
   */
  updateConfig(config: Partial<SearchProviderConfig>): void;
}
