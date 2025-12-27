/**
 * 博查API类型定义
 * 基于 OpenAPI 3.0.3 规范生成
 */

/**
 * 搜索新鲜度选项
 */
export type BochaFreshness = 'noLimit' | 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear';

/**
 * 博查API请求参数
 */
export interface BochaWebSearchRequest {
  /**
   * 搜索关键字或语句
   */
  query: string;

  /**
   * 返回的搜索结果数量（1-50），默认为10
   */
  count: number;

  /**
   * 是否在搜索结果中包含摘要
   */
  summary?: boolean;

  /**
   * 搜索指定时间范围内的网页
   */
  freshness?: BochaFreshness;
}

/**
 * 网页搜索结果项
 */
export interface BochaWebPageResult {
  /**
   * 网页的排序ID
   */
  id?: string | null;

  /**
   * 网页的标题
   */
  name: string;

  /**
   * 网页的URL
   */
  url: string;

  /**
   * 网页的展示URL
   */
  displayUrl: string;

  /**
   * 网页内容的简短描述
   */
  snippet: string;

  /**
   * 网页内容的文本摘要
   */
  summary?: string;

  /**
   * 网页的网站名称
   */
  siteName?: string;

  /**
   * 网页的网站图标
   */
  siteIcon?: string;

  /**
   * 网页的发布时间
   */
  datePublished?: string;

  /**
   * 网页的收录时间或发布时间
   */
  dateLastCrawled?: string;

  /**
   * 网页的缓存页面URL
   */
  cachedPageUrl?: string | null;

  /**
   * 网页的语言
   */
  language?: string | null;

  /**
   * 是否为家庭友好的页面
   */
  isFamilyFriendly?: boolean | null;

  /**
   * 是否为导航性页面
   */
  isNavigational?: boolean | null;
}

/**
 * 网页搜索结果列表
 */
export interface BochaWebPages {
  /**
   * 网页搜索的URL
   */
  webSearchUrl: string;

  /**
   * 搜索匹配的网页总数
   */
  totalEstimatedMatches: number;

  /**
   * 搜索结果列表
   */
  value: BochaWebPageResult[];
}

/**
 * 查询上下文
 */
export interface BochaQueryContext {
  /**
   * 原始的搜索关键字
   */
  originalQuery: string;
}

/**
 * 博查API响应数据
 */
export interface BochaWebSearchResponseData {
  /**
   * 搜索的类型
   */
  _type: string;

  /**
   * 查询上下文
   */
  queryContext: BochaQueryContext;

  /**
   * 网页搜索结果
   */
  webPages: BochaWebPages;

  /**
   * 图片搜索结果（可选）
   */
  images?: any;

  /**
   * 视频搜索结果（可选）
   */
  videos?: any;
}

/**
 * 博查API响应
 */
export interface BochaWebSearchResponse {
  /**
   * 响应的状态码
   */
  code: number;

  /**
   * 请求的唯一日志ID
   */
  log_id: string;

  /**
   * 请求的消息提示（如果有的话）
   */
  msg: string | null;

  /**
   * 响应数据
   */
  data: BochaWebSearchResponseData;
}
