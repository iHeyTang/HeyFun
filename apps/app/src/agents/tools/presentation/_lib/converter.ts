/**
 * 数据转换函数：将旧格式转换为新格式
 */
import type { PresentationData, Slide, SlideElement, Theme, LegacySlide, LegacyStyle, Layout, TextStyle, SlideBackground } from './types';

/**
 * 根据主题名称获取主题配置
 */
function getThemeConfig(themeName: string, colorScheme: 'light' | 'dark'): Theme {
  const isLight = colorScheme === 'light';

  const themes: Record<string, { light: Theme; dark: Theme }> = {
    default: {
      light: {
        name: 'default',
        colorScheme: 'light',
        colors: {
          primary: '#1a1a1a',
          secondary: '#666',
          accent: '#666',
          background: '#ffffff',
          text: '#1a1a1a',
          textSecondary: '#666',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'default',
        colorScheme: 'dark',
        colors: {
          primary: '#ffffff',
          secondary: '#b0b0b0',
          accent: '#888',
          background: '#1a1a1a',
          text: '#e5e5e5',
          textSecondary: '#b0b0b0',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
    minimal: {
      light: {
        name: 'minimal',
        colorScheme: 'light',
        colors: {
          primary: '#34495e',
          secondary: '#7f8c8d',
          accent: '#3498db',
          background: '#fafafa',
          text: '#2c3e50',
          textSecondary: '#7f8c8d',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'minimal',
        colorScheme: 'dark',
        colors: {
          primary: '#ffffff',
          secondary: '#bdc3c7',
          accent: '#3498db',
          background: '#1e1e1e',
          text: '#ecf0f1',
          textSecondary: '#bdc3c7',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
    professional: {
      light: {
        name: 'professional',
        colorScheme: 'light',
        colors: {
          primary: '#1a237e',
          secondary: '#5c6bc0',
          accent: '#3f51b5',
          background: '#ffffff',
          text: '#2c3e50',
          textSecondary: '#666',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'professional',
        colorScheme: 'dark',
        colors: {
          primary: '#7986cb',
          secondary: '#9fa8da',
          accent: '#5c6bc0',
          background: '#1e1e1e',
          text: '#e0e0e0',
          textSecondary: '#b0b0b0',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
    modern: {
      light: {
        name: 'modern',
        colorScheme: 'light',
        colors: {
          primary: '#2d3748',
          secondary: '#4a5568',
          accent: '#667eea',
          background: '#ffffff',
          text: '#1a202c',
          textSecondary: '#4a5568',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'modern',
        colorScheme: 'dark',
        colors: {
          primary: '#f0f6fc',
          secondary: '#8b949e',
          accent: '#58a6ff',
          background: '#161b22',
          text: '#c9d1d9',
          textSecondary: '#8b949e',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
    creative: {
      light: {
        name: 'creative',
        colorScheme: 'light',
        colors: {
          primary: '#c53030',
          secondary: '#e53e3e',
          accent: '#f56565',
          background: '#ffffff',
          text: '#2d3748',
          textSecondary: '#666',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'creative',
        colorScheme: 'dark',
        colors: {
          primary: '#fc8181',
          secondary: '#feb2b2',
          accent: '#f56565',
          background: '#2d1b1b',
          text: '#fed7d7',
          textSecondary: '#feb2b2',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
    corporate: {
      light: {
        name: 'corporate',
        colorScheme: 'light',
        colors: {
          primary: '#1a365d',
          secondary: '#2c5282',
          accent: '#2b6cb0',
          background: '#ffffff',
          text: '#2d3748',
          textSecondary: '#666',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
      dark: {
        name: 'corporate',
        colorScheme: 'dark',
        colors: {
          primary: '#cbd5e1',
          secondary: '#94a3b8',
          accent: '#60a5fa',
          background: '#1e293b',
          text: '#e2e8f0',
          textSecondary: '#94a3b8',
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: { h1: 48, h2: 32, h3: 24, body: 20, small: 16 },
        },
        spacing: { slidePadding: 60, elementGap: 20 },
      },
    },
  };

  const theme = themes[themeName] || themes.default;
  if (!theme) {
    const defaultTheme = themes.default;
    if (!defaultTheme) {
      throw new Error('Default theme not found');
    }
    return defaultTheme.light;
  }
  return isLight ? theme.light : theme.dark;
}

/**
 * 将旧格式的幻灯片转换为新格式
 */
export function convertLegacySlideToNewFormat(legacySlide: LegacySlide, index: number, theme: Theme): Slide {
  const slideId = `slide-${index}`;

  // 根据旧类型确定新布局
  let layout: Slide['layout'] = 'content-only';
  if (legacySlide.type === 'title') {
    layout = 'title';
  } else if (legacySlide.type === 'section') {
    layout = 'section';
  } else if (legacySlide.type === 'image') {
    layout = 'image-full';
  } else if (legacySlide.content && legacySlide.content.length > 0) {
    layout = 'title-content';
  }

  const elements: SlideElement[] = [];

  // 添加标题元素
  if (legacySlide.title) {
    const isTitleSlide = layout === 'title' || layout === 'section';
    elements.push({
      id: `${slideId}-title`,
      type: 'heading',
      content: legacySlide.title,
      layout: {
        x: layout === 'section' ? 10 : 10,
        y: isTitleSlide ? 35 : 10,
        width: 80,
        height: isTitleSlide ? 20 : 15,
      },
      style: {
        fontSize: isTitleSlide ? theme.typography.fontSize.h1 : theme.typography.fontSize.h2,
        fontWeight: 'bold',
        align: layout === 'section' ? 'center' : 'left',
        color: theme.colors.primary,
      },
    });
  }

  // 添加副标题元素
  if (legacySlide.subtitle) {
    elements.push({
      id: `${slideId}-subtitle`,
      type: 'text',
      content: legacySlide.subtitle,
      layout: { x: 10, y: 50, width: 80, height: 10 },
      style: {
        fontSize: theme.typography.fontSize.h3,
        align: 'center',
        color: theme.colors.textSecondary,
      },
    });
  }

  // 添加内容列表
  if (legacySlide.content && legacySlide.content.length > 0) {
    const startY = layout === 'title' ? 60 : legacySlide.title ? 30 : 20;
    elements.push({
      id: `${slideId}-content`,
      type: 'list',
      content: legacySlide.content,
      layout: {
        x: 15,
        y: startY,
        width: 70,
        height: 70 - startY,
      },
      style: {
        fontSize: theme.typography.fontSize.body,
        lineHeight: 1.6,
        color: theme.colors.text,
      },
    });
  }

  // 添加图片元素（智能布局）
  if (legacySlide.imageUrl) {
    const hasTitle = !!legacySlide.title;
    const hasContent = legacySlide.content && legacySlide.content.length > 0;
    const contentCount = legacySlide.content?.length || 0;

    // 智能选择图片布局策略
    if (hasContent && contentCount > 0) {
      // 有文字内容：使用左右分栏布局
      // 图片在右侧，占40-45%
      elements.push({
        id: `${slideId}-image`,
        type: 'image',
        imageUrl: legacySlide.imageUrl,
        alt: legacySlide.title || '',
        layout: {
          x: 55, // 图片从55%开始
          y: hasTitle ? 25 : 15, // 如果有标题，从25%开始，否则15%
          width: 40, // 宽度40%
          height: hasTitle ? 70 : 80, // 高度70-80%
        },
      });

      // 调整内容列表位置（为图片让出空间）
      const contentElement = elements.find(el => el.id === `${slideId}-content`);
      if (contentElement) {
        contentElement.layout = {
          x: 10,
          y: hasTitle ? 30 : 20,
          width: 40, // 内容宽度减少到40%
          height: hasTitle ? 65 : 75,
        };
      }
    } else if (hasTitle && !hasContent) {
      // 只有标题+图片：使用全屏背景模式
      // 图片作为背景，标题叠加
      // 这里不添加图片元素，而是通过 background 处理
      // 但为了兼容，还是添加图片元素，但使用全屏布局
      elements.push({
        id: `${slideId}-image`,
        type: 'image',
        imageUrl: legacySlide.imageUrl,
        alt: legacySlide.title || '',
        layout: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      });
      // 标题需要加背景或阴影以确保可读性
      const titleElement = elements.find(el => el.id === `${slideId}-title`);
      if (titleElement && titleElement.style) {
        // 添加文字阴影以提高可读性
        titleElement.style.color = '#ffffff';
      }
    } else {
      // 只有图片：全屏显示
      elements.push({
        id: `${slideId}-image`,
        type: 'image',
        imageUrl: legacySlide.imageUrl,
        alt: legacySlide.title || '',
        layout: {
          x: 5,
          y: 10,
          width: 90,
          height: 80,
        },
      });
    }
  }

  // 处理背景
  let background: Slide['background'] | undefined;
  // 背景会在转换函数中根据 style 设置

  return {
    id: slideId,
    index,
    layout,
    title: legacySlide.title,
    subtitle: legacySlide.subtitle,
    elements,
    background,
    notes: legacySlide.notes,
  };
}

/**
 * 扩展的幻灯片数据（支持 AI 指定的设计信息）
 */
export interface ExtendedLegacySlide extends LegacySlide {
  layout?: Slide['layout'];
  elements?: Array<{
    type: 'heading' | 'text' | 'list' | 'image';
    content?: string | string[];
    imageUrl?: string;
    layout?: Layout;
    style?: TextStyle;
  }>;
  background?: SlideBackground;
}

/**
 * 将旧格式转换为新格式（支持 AI 指定的设计信息）
 */
export function convertLegacyPresentationToNewFormat(
  title: string,
  legacySlides: (LegacySlide | ExtendedLegacySlide)[],
  style: LegacyStyle,
): PresentationData {
  const theme = getThemeConfig(style.theme, style.colorScheme);

  // 如果自定义了背景色，更新主题
  if (style.backgroundColor) {
    theme.colors.background = style.backgroundColor;
  }

  const slides = legacySlides.map((legacySlide, index) => {
    // 如果 AI 提供了详细的设计信息，直接使用
    if ('elements' in legacySlide && legacySlide.elements && legacySlide.elements.length > 0) {
      const slideId = `slide-${index}`;
      const slide: Slide = {
        id: slideId,
        index,
        layout: legacySlide.layout || 'content-only',
        title: legacySlide.title,
        subtitle: legacySlide.subtitle,
        elements: legacySlide.elements.map((el, elIndex) => ({
          id: `${slideId}-element-${elIndex}`,
          type: el.type,
          content: el.content,
          imageUrl: el.imageUrl,
          layout: el.layout || { x: 10, y: 10, width: 80, height: 80 }, // 默认布局
          style: el.style,
        })),
        background: legacySlide.background,
        notes: legacySlide.notes,
      };

      // 如果 style 中指定了背景，覆盖 AI 指定的背景
      if (style.backgroundColor || style.backgroundImage) {
        slide.background = {
          type: style.backgroundImage ? 'image' : 'color',
          color: style.backgroundColor,
          imageUrl: style.backgroundImage,
        };
      }

      return slide;
    }

    // 否则，使用智能分析（原有逻辑）
    const slide = convertLegacySlideToNewFormat(legacySlide, index, theme);

    // 如果 AI 指定了布局，使用 AI 的布局
    if ('layout' in legacySlide && legacySlide.layout) {
      slide.layout = legacySlide.layout;
    }

    // 处理自定义背景
    if (style.backgroundColor || style.backgroundImage) {
      slide.background = {
        type: style.backgroundImage ? 'image' : 'color',
        color: style.backgroundColor,
        imageUrl: style.backgroundImage,
      };
    } else if ('background' in legacySlide && legacySlide.background) {
      // 如果 AI 指定了背景，使用 AI 的背景
      slide.background = legacySlide.background;
    }

    return slide;
  });

  return {
    metadata: {
      title,
      createdAt: new Date().toISOString(),
      version: 1,
    },
    theme,
    slides,
    settings: {
      aspectRatio: '16:9',
      language: 'zh-CN',
    },
  };
}
