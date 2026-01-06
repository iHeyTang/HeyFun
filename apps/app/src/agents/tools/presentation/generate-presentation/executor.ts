import { ToolContext } from '../../context';
import { generatePresentationParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { ensureSandbox, saveSandboxHandleToState } from '../../sandbox/utils';
import { AssetManager } from '@/lib/server/asset-manager';

export const generatePresentationExecutor = definitionToolExecutor(generatePresentationParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'generate-presentation'}`, async () => {
    try {
      if (!context.sessionId || !context.organizationId) {
        return {
          success: false,
          error: 'Session ID and Organization ID are required',
        };
      }

      const { title, slides, style = { theme: 'default', colorScheme: 'light' }, exportFormats = ['html'] } = args;

      // 确保 sandbox 存在，如果不存在则自动创建
      const handle = await ensureSandbox(context.sessionId);

      const srm = getSandboxRuntimeManager();
      const instance = await srm.get(handle);

      // 生成HTML内容（在TypeScript中生成，更可靠）
      let htmlContent = '';
      if (exportFormats.includes('html')) {
        htmlContent = generateHtmlContent(title, slides, style);
        await srm.writeFile(handle, 'presentation.html', htmlContent);
      }

      // 生成Python脚本（仅用于生成PPTX）
      const pythonScript = generatePythonScript(title, slides, style, exportFormats);

      // 写入Python脚本
      await srm.writeFile(handle, 'generate_presentation.py', pythonScript);

      // 安装依赖（如果需要生成pptx）
      // exec方法现在会自动在workspaceRoot目录执行，无需手动cd
      if (exportFormats.includes('pptx')) {
        const installResult = await srm.exec(handle, 'pip install python-pptx', { timeout: 120 });
        if (installResult.exitCode !== 0) {
          console.warn('Failed to install python-pptx:', installResult.stderr);
        }
      }

      // 执行Python脚本（exec方法会自动在workspaceRoot目录执行）
      const execResult = await srm.exec(handle, 'python generate_presentation.py', { timeout: 300 });
      if (execResult.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to generate presentation: ${execResult.stderr || execResult.stdout}`,
        };
      }

      // 使用 AssetManager 上传文件，确保路径正确并创建 Assets 记录
      const assets: Array<{ id: string; fileKey: string; fileUrl: string; type: string }> = [];
      let htmlUrl = '';
      let pptxUrl = '';

      if (!context.organizationId || !context.sessionId) {
        return {
          success: false,
          error: 'Organization ID and Session ID are required',
        };
      }

      // 上传HTML文件（已在TypeScript中生成）
      if (exportFormats.includes('html') && htmlContent) {
        try {
          const htmlAsset = await AssetManager.createAsset({
            organizationId: context.organizationId,
            sessionId: context.sessionId,
            fileContent: Buffer.from(htmlContent, 'utf-8'),
            fileName: `${title || 'presentation'}.html`,
            mimeType: 'text/html',
            type: 'presentation',
            title: `${title || '演示文稿'} (HTML)`,
            description: `HTML版本的演示文稿：${title}`,
            toolCallId: context.toolCallId,
            messageId: context.messageId,
            metadata: {
              presentationTitle: title,
              slides: slides,
              style: style,
              exportFormats: exportFormats,
              version: 1,
              isHistory: false,
            },
          });
          assets.push(htmlAsset);
          htmlUrl = htmlAsset.fileUrl;
        } catch (error) {
          console.error('Failed to upload HTML:', error);
        }
      }

      // 读取PPTX文件（使用base64编码）
      if (exportFormats.includes('pptx')) {
        try {
          // 使用Python脚本将PPTX转换为base64
          const base64Script = `
import base64
import sys

try:
    with open('presentation.pptx', 'rb') as f:
        data = base64.b64encode(f.read()).decode('utf-8')
        print(data)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
          await srm.writeFile(handle, 'read_pptx.py', base64Script);
          const base64Result = await srm.exec(handle, 'python read_pptx.py', { timeout: 60 });
          if (base64Result.exitCode === 0 && base64Result.stdout) {
            const pptxBuffer = Buffer.from(base64Result.stdout.trim(), 'base64');
            const pptxAsset = await AssetManager.createAsset({
              organizationId: context.organizationId,
              sessionId: context.sessionId,
              fileContent: pptxBuffer,
              fileName: `${title || 'presentation'}.pptx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              type: 'presentation',
              title: `${title || '演示文稿'} (PPTX)`,
              description: `PPTX版本的演示文稿：${title}`,
              toolCallId: context.toolCallId,
              messageId: context.messageId,
              metadata: {
                presentationTitle: title,
                slides: slides,
                style: style,
                exportFormats: exportFormats,
                version: 1,
                isHistory: false,
              },
            });
            assets.push(pptxAsset);
            pptxUrl = pptxAsset.fileUrl;
          } else {
            console.error('Failed to read PPTX as base64:', base64Result.stderr);
          }
        } catch (error) {
          console.error('Failed to read/upload PPTX:', error);
        }
      }

      // 更新handle
      const updatedHandle = updateSandboxHandleLastUsed(instance.handle);
      await saveSandboxHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data: {
          htmlUrl: htmlUrl || undefined,
          pptxUrl: pptxUrl || undefined,
          assets: assets.map(a => ({
            id: a.id,
            fileKey: a.fileKey,
            fileUrl: a.fileUrl,
            type: a.type,
          })),
          // 向后兼容：保留 fileKeys
          fileKeys: assets.map(a => a.fileKey),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
});

/**
 * 生成Python脚本
 */
export function generatePythonScript(
  title: string,
  slides: Array<{
    type: 'title' | 'content' | 'section' | 'image';
    title?: string;
    subtitle?: string;
    content?: string[];
    imageUrl?: string;
    notes?: string;
  }>,
  style: { theme: string; colorScheme: string },
  exportFormats: string[],
): string {
  const slidesJson = JSON.stringify(slides);
  const styleJson = JSON.stringify(style);

  return `
import json
import os

# 配置
TITLE = json.loads(${JSON.stringify(JSON.stringify(title))})
SLIDES = json.loads(${JSON.stringify(JSON.stringify(slides))})
STYLE = json.loads(${JSON.stringify(JSON.stringify(style))})
EXPORT_FORMATS = json.loads(${JSON.stringify(JSON.stringify(exportFormats))})

# 生成PPTX
if 'pptx' in EXPORT_FORMATS:
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt
        from pptx.enum.text import PP_ALIGN
        
        prs = Presentation()
        
        for slide_data in SLIDES:
            slide_type = slide_data.get('type', 'content')
            
            if slide_type == 'title':
                # 标题页
                slide = prs.slides.add_slide(prs.slide_layouts[0])
                title_shape = slide.shapes.title
                subtitle_shape = slide.placeholders[1]
                
                title_shape.text = slide_data.get('title', TITLE)
                if slide_data.get('subtitle'):
                    subtitle_shape.text = slide_data.get('subtitle')
            
            elif slide_type == 'section':
                # 章节页
                slide = prs.slides.add_slide(prs.slide_layouts[1])
                title_shape = slide.shapes.title
                title_shape.text = slide_data.get('title', '')
            
            else:
                # 内容页
                slide = prs.slides.add_slide(prs.slide_layouts[1])
                title_shape = slide.shapes.title
                content_shape = slide.placeholders[1]
                
                if slide_data.get('title'):
                    title_shape.text = slide_data.get('title')
                
                if slide_data.get('content'):
                    tf = content_shape.text_frame
                    tf.word_wrap = True
                    for i, point in enumerate(slide_data.get('content', [])):
                        if i > 0:
                            p = tf.add_paragraph()
                        else:
                            p = tf.paragraphs[0]
                        p.text = point
                        p.level = 0
                        p.font.size = Pt(18)
        
        prs.save('presentation.pptx')
        print("PPTX generated successfully")
    except ImportError:
        print("python-pptx not installed, skipping PPTX generation")
    except Exception as e:
        print(f"Error generating PPTX: {e}")
`;
}

/**
 * 在TypeScript中生成HTML内容
 */
export function generateHtmlContent(
  title: string,
  slides: Array<{
    type: 'title' | 'content' | 'section' | 'image';
    title?: string;
    subtitle?: string;
    content?: string[];
    imageUrl?: string;
    notes?: string;
  }>,
  style: { theme: string; colorScheme: string; backgroundColor?: string; backgroundImage?: string },
): string {
  function escapeHtml(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const slidesHtml = slides
    .map((slideData, i) => {
      const isFirst = i === 0;
      const activeClass = isFirst ? 'active' : '';
      const slideType = slideData.type || 'content';
      const slideTitle = slideData.title || '';

      if (slideType === 'title') {
        let html = `\n    <div class="slide ${activeClass} slide-title">\n      <div class="slide-content">\n        <h1 class="slide-title">${escapeHtml(slideTitle || title)}</h1>`;
        if (slideData.subtitle) {
          html += `\n        <p class="slide-subtitle">${escapeHtml(slideData.subtitle)}</p>`;
        }
        html += '\n      </div>\n    </div>';
        return html;
      } else if (slideType === 'section') {
        return `\n    <div class="slide ${activeClass} slide-section">\n      <div class="slide-content slide-section">\n        <h1 class="slide-title">${escapeHtml(slideTitle)}</h1>\n      </div>\n    </div>`;
      } else if (slideType === 'image') {
        let html = `\n    <div class="slide ${activeClass} slide-image">\n      <div class="slide-content">`;
        if (slideTitle) {
          html += `\n        <h2 class="slide-title">${escapeHtml(slideTitle)}</h2>`;
        }
        if (slideData.imageUrl) {
          html += `\n        <img src="${escapeHtml(slideData.imageUrl)}" alt="${escapeHtml(slideTitle)}" class="slide-image" />`;
        }
        html += '\n      </div>\n    </div>';
        return html;
      } else {
        const contentItems = slideData.content || [];
        let contentHtml = '';
        if (contentItems.length > 0) {
          contentHtml = '\n        <ul>';
          for (const item of contentItems) {
            contentHtml += `\n          <li>${escapeHtml(item)}</li>`;
          }
          contentHtml += '\n        </ul>';
        }

        let html = `\n    <div class="slide ${activeClass}">\n      <div class="slide-content">`;
        if (slideTitle) {
          html += `\n        <h2 class="slide-title">${escapeHtml(slideTitle)}</h2>`;
        }
        html += contentHtml + '\n      </div>\n    </div>';
        return html;
      }
    })
    .join('');

  // 根据主题生成样式
  const themeStyles = getThemeStyles(style.theme, style.colorScheme);

  // 应用自定义背景
  if (style.backgroundColor) {
    themeStyles.slideBackground = style.backgroundColor;
  }
  if (style.backgroundImage) {
    themeStyles.slideBackgroundImage = `url(${escapeHtml(style.backgroundImage)})`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background: ${themeStyles.bodyBackground};
      color: ${themeStyles.textColor};
      overflow: hidden;
    }

    .presentation-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .slide {
      width: 100%;
      height: 100%;
      display: none;
      padding: 60px 80px;
      background: ${themeStyles.slideBackground};
      background-image: ${themeStyles.slideBackgroundImage || 'none'};
      background-size: cover;
      background-position: center;
      overflow-y: auto;
      position: relative;
    }

    .slide.active {
      display: flex;
      flex-direction: column;
    }

    .slide-title {
      font-size: 48px;
      font-weight: 600;
      margin-bottom: 30px;
      color: ${themeStyles.titleColor};
      line-height: 1.2;
      text-shadow: ${themeStyles.titleShadow || 'none'};
    }

    .slide-subtitle {
      font-size: 32px;
      color: ${themeStyles.subtitleColor};
      margin-top: 20px;
      font-weight: 400;
    }

    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      z-index: 1;
    }

    .slide-content ul {
      list-style: none;
      padding: 0;
    }

    .slide-content li {
      font-size: 28px;
      line-height: 1.8;
      margin-bottom: 20px;
      padding-left: 40px;
      position: relative;
      color: ${themeStyles.textColor};
    }

    .slide-content li:before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${themeStyles.accentColor};
      font-size: 32px;
    }

    .slide-image {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .slide-section {
      text-align: center;
      justify-content: center;
    }

    .slide-section .slide-title {
      font-size: 56px;
      color: ${themeStyles.titleColor};
    }

    .slide-number {
      position: fixed;
      top: 20px;
      left: 20px;
      background: ${themeStyles.colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      color: ${themeStyles.colorScheme === 'dark' ? '#d0d0d0' : '#666'};
      z-index: 100;
      pointer-events: none;
    }

    .presentation-container {
      cursor: pointer;
    }

    @media (max-width: 768px) {
      .slide {
        padding: 40px 30px;
      }

      .slide-title {
        font-size: 32px;
      }

      .slide-subtitle {
        font-size: 24px;
      }

      .slide-content li {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="presentation-container">
    <div class="slide-number">
      <span id="current-slide">1</span> / <span id="total-slides">${slides.length}</span>
    </div>

${slidesHtml}
  </div>

  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;

    function showSlide(n) {
      if (slides.length === 0) return;
      slides[currentSlide].classList.remove('active');
      currentSlide = (n + totalSlides) % totalSlides;
      slides[currentSlide].classList.add('active');
      
      const currentSlideEl = document.getElementById('current-slide');
      if (currentSlideEl) currentSlideEl.textContent = currentSlide + 1;
    }

    function nextSlide() {
      if (currentSlide < totalSlides - 1) {
        showSlide(currentSlide + 1);
      }
    }

    function previousSlide() {
      if (currentSlide > 0) {
        showSlide(currentSlide - 1);
      }
    }

    // 鼠标点击导航：点击右侧下一张，点击左侧上一张
    document.addEventListener('click', (e) => {
      const container = document.querySelector('.presentation-container');
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const containerWidth = rect.width;
      
      // 点击右侧50%区域：下一张
      if (clickX > containerWidth / 2) {
        nextSlide();
      } else {
        // 点击左侧50%区域：上一张
        previousSlide();
      }
    });

    // 键盘导航
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousSlide();
      }
    });

    // 初始化
    if (slides.length > 0) {
      showSlide(0);
    }
  </script>
</body>
</html>`;
}

/**
 * 根据主题获取样式配置
 */
export function getThemeStyles(theme: string, colorScheme: string) {
  const themes: Record<string, Record<string, any>> = {
    default: {
      light: {
        bodyBackground: '#f5f5f5',
        slideBackground: 'white',
        slideBackgroundImage: 'none',
        textColor: '#1a1a1a',
        titleColor: '#1a1a1a',
        subtitleColor: '#666',
        accentColor: '#666',
        titleShadow: 'none',
      },
      dark: {
        bodyBackground: '#1a1a1a',
        slideBackground: '#2a2a2a',
        slideBackgroundImage: 'none',
        textColor: '#e5e5e5',
        titleColor: '#ffffff',
        subtitleColor: '#b0b0b0',
        accentColor: '#888',
        titleShadow: 'none',
      },
    },
    minimal: {
      light: {
        bodyBackground: '#ffffff',
        slideBackground: '#fafafa',
        slideBackgroundImage: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        textColor: '#2c3e50',
        titleColor: '#34495e',
        subtitleColor: '#7f8c8d',
        accentColor: '#3498db',
        titleShadow: 'none',
      },
      dark: {
        bodyBackground: '#1e1e1e',
        slideBackground: '#2d2d2d',
        slideBackgroundImage: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
        textColor: '#ecf0f1',
        titleColor: '#ffffff',
        subtitleColor: '#bdc3c7',
        accentColor: '#3498db',
        titleShadow: 'none',
      },
    },
    professional: {
      light: {
        bodyBackground: '#e8e8e8',
        slideBackground: '#ffffff',
        slideBackgroundImage: 'linear-gradient(to bottom, #ffffff 0%, #f0f0f0 100%)',
        textColor: '#2c3e50',
        titleColor: '#1a237e',
        subtitleColor: '#5c6bc0',
        accentColor: '#3f51b5',
        titleShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      dark: {
        bodyBackground: '#121212',
        slideBackground: '#1e1e1e',
        slideBackgroundImage: 'linear-gradient(to bottom, #1e1e1e 0%, #121212 100%)',
        textColor: '#e0e0e0',
        titleColor: '#7986cb',
        subtitleColor: '#9fa8da',
        accentColor: '#5c6bc0',
        titleShadow: '0 2px 8px rgba(0,0,0,0.3)',
      },
    },
    modern: {
      light: {
        bodyBackground: '#f0f4f8',
        slideBackground: '#ffffff',
        slideBackgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        textColor: '#1a202c',
        titleColor: '#2d3748',
        subtitleColor: '#4a5568',
        accentColor: '#667eea',
        titleShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      dark: {
        bodyBackground: '#0d1117',
        slideBackground: '#161b22',
        slideBackgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        textColor: '#c9d1d9',
        titleColor: '#f0f6fc',
        subtitleColor: '#8b949e',
        accentColor: '#58a6ff',
        titleShadow: '0 2px 8px rgba(0,0,0,0.5)',
      },
    },
    creative: {
      light: {
        bodyBackground: '#fff5f5',
        slideBackground: '#ffffff',
        slideBackgroundImage: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        textColor: '#2d3748',
        titleColor: '#c53030',
        subtitleColor: '#e53e3e',
        accentColor: '#f56565',
        titleShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      dark: {
        bodyBackground: '#1a0a0a',
        slideBackground: '#2d1b1b',
        slideBackgroundImage: 'linear-gradient(135deg, #2d1b1b 0%, #1a0a0a 100%)',
        textColor: '#fed7d7',
        titleColor: '#fc8181',
        subtitleColor: '#feb2b2',
        accentColor: '#f56565',
        titleShadow: '0 2px 8px rgba(0,0,0,0.5)',
      },
    },
    corporate: {
      light: {
        bodyBackground: '#f7fafc',
        slideBackground: '#ffffff',
        slideBackgroundImage: 'linear-gradient(to bottom, #ffffff 0%, #edf2f7 100%)',
        textColor: '#2d3748',
        titleColor: '#1a365d',
        subtitleColor: '#2c5282',
        accentColor: '#2b6cb0',
        titleShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      dark: {
        bodyBackground: '#0f172a',
        slideBackground: '#1e293b',
        slideBackgroundImage: 'linear-gradient(to bottom, #1e293b 0%, #0f172a 100%)',
        textColor: '#e2e8f0',
        titleColor: '#cbd5e1',
        subtitleColor: '#94a3b8',
        accentColor: '#60a5fa',
        titleShadow: '0 2px 8px rgba(0,0,0,0.3)',
      },
    },
  };

  const selectedTheme = themes[theme] || themes.default;
  if (!selectedTheme) {
    // 确保default主题存在（理论上不会发生，因为themes对象中一定有default）
    return themes.default!.light;
  }
  return selectedTheme[colorScheme] || selectedTheme.light;
}
