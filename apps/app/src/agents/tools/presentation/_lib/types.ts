/**
 * 统一的演示文稿数据结构
 * 兼容 HTML 展示和 PPTX 导出
 */

/**
 * 幻灯片元素类型
 */
export type SlideElementType =
  | 'text' // 文本
  | 'heading' // 标题
  | 'list' // 列表
  | 'image' // 图片
  | 'shape' // 形状
  | 'chart' // 图表
  | 'code' // 代码块
  | 'quote' // 引用
  | 'divider'; // 分隔线

/**
 * 文本样式
 */
export interface TextStyle {
  fontSize?: number; // 字体大小（pt）
  fontWeight?: 'normal' | 'bold' | 'lighter' | number;
  fontFamily?: string; // 字体族
  color?: string; // 颜色（hex）
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number; // 行高
  letterSpacing?: number; // 字间距
}

/**
 * 布局位置和大小（百分比坐标 0-100）
 */
export interface Layout {
  x: number; // X坐标（百分比 0-100）
  y: number; // Y坐标（百分比 0-100）
  width: number; // 宽度（百分比 0-100）
  height: number; // 高度（百分比 0-100）
  zIndex?: number; // 层级
}

/**
 * 幻灯片元素
 */
export interface SlideElement {
  id: string; // 唯一标识
  type: SlideElementType;
  content?: string | string[]; // 内容（文本或列表项）
  layout: Layout; // 布局信息
  style?: TextStyle; // 样式（仅文本元素）
  imageUrl?: string; // 图片URL（仅图片元素）
  alt?: string; // 图片alt文本
  metadata?: Record<string, any>; // 扩展元数据
}

/**
 * 幻灯片布局类型
 */
export type SlideLayoutType =
  | 'title' // 标题页
  | 'title-content' // 标题+内容
  | 'content-only' // 仅内容
  | 'two-column' // 两列布局
  | 'image-left' // 图片在左
  | 'image-right' // 图片在右
  | 'image-full' // 全图
  | 'section' // 章节页
  | 'blank'; // 空白页

/**
 * 幻灯片背景
 */
export interface SlideBackground {
  type: 'color' | 'gradient' | 'image';
  color?: string; // 背景颜色（hex）
  gradient?: {
    // 渐变
    direction: 'linear' | 'radial';
    stops: Array<{ offset: number; color: string }>;
    angle?: number; // 渐变角度（度）
  };
  imageUrl?: string; // 背景图片URL
  opacity?: number; // 透明度 0-1
}

/**
 * 幻灯片
 */
export interface Slide {
  id: string; // 唯一标识
  index: number; // 索引
  layout: SlideLayoutType; // 布局类型
  title?: string; // 标题（兼容旧格式）
  subtitle?: string; // 副标题（兼容旧格式）
  elements: SlideElement[]; // 元素列表
  background?: SlideBackground; // 背景
  notes?: string; // 备注
  transition?: {
    // 过渡效果（HTML用）
    type?: 'fade' | 'slide' | 'zoom' | 'none';
    duration?: number;
  };
  metadata?: Record<string, any>; // 扩展元数据
}

/**
 * 主题配置
 */
export interface Theme {
  name: string;
  colorScheme: 'light' | 'dark';
  colors: {
    primary: string; // 主色
    secondary: string; // 次色
    accent: string; // 强调色
    background: string; // 背景色
    text: string; // 文本色
    textSecondary: string; // 次要文本色
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
    fontSize: {
      h1: number;
      h2: number;
      h3: number;
      body: number;
      small: number;
    };
  };
  spacing: {
    slidePadding: number; // 幻灯片内边距（px）
    elementGap: number; // 元素间距（px）
  };
}

/**
 * 演示文稿元数据
 */
export interface PresentationMetadata {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  keywords?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/**
 * 完整的演示文稿数据结构
 */
export interface PresentationData {
  metadata: PresentationMetadata;
  theme: Theme;
  slides: Slide[];
  settings?: {
    aspectRatio?: '16:9' | '4:3' | '16:10'; // 宽高比
    language?: string; // 语言
  };
}

/**
 * 旧格式的幻灯片数据（兼容）
 */
export interface LegacySlide {
  type: 'title' | 'content' | 'section' | 'image';
  title?: string;
  subtitle?: string;
  content?: string[];
  imageUrl?: string;
  notes?: string;
}

/**
 * 旧格式的样式配置（兼容）
 */
export interface LegacyStyle {
  theme: string;
  colorScheme: 'light' | 'dark';
  backgroundColor?: string;
  backgroundImage?: string;
}
