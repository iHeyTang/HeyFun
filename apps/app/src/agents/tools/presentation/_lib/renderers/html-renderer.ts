/**
 * HTML 渲染器：将 PresentationData 渲染为 HTML
 */
import type { PresentationData, Slide, SlideElement, Theme } from '../types';

function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 渲染单个元素
 */
function renderElement(element: SlideElement, theme: Theme): string {
  const { x, y, width, height } = element.layout;
  const style = `position: absolute; left: ${x}%; top: ${y}%; width: ${width}%; height: ${height}%;`;

  switch (element.type) {
    case 'heading': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.h2;
      const color = textStyle.color || theme.colors.primary;
      const align = textStyle.align || 'left';
      const fontWeight = textStyle.fontWeight || 'bold';

      return `
        <div class="element element-heading" style="${style}">
          <h2 style="font-size: ${fontSize}px; color: ${color}; text-align: ${align}; font-weight: ${fontWeight}; margin: 0; padding: 0;">
            ${escapeHtml(Array.isArray(element.content) ? element.content[0] : element.content)}
          </h2>
        </div>`;
    }

    case 'text': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.body;
      const color = textStyle.color || theme.colors.text;
      const align = textStyle.align || 'left';
      const lineHeight = textStyle.lineHeight || 1.6;

      return `
        <div class="element element-text" style="${style}">
          <p style="font-size: ${fontSize}px; color: ${color}; text-align: ${align}; line-height: ${lineHeight}; margin: 0; padding: 0;">
            ${escapeHtml(Array.isArray(element.content) ? element.content[0] : element.content)}
          </p>
        </div>`;
    }

    case 'list': {
      const textStyle = element.style || {};
      const fontSize = textStyle.fontSize || theme.typography.fontSize.body;
      const color = textStyle.color || theme.colors.text;
      const lineHeight = textStyle.lineHeight || 1.6;
      const items = Array.isArray(element.content) ? element.content : [];

      const listItems = items
        .map(
          item =>
            `<li style="font-size: ${fontSize}px; color: ${color}; line-height: ${lineHeight}; margin-bottom: 12px;">
              ${escapeHtml(item)}
            </li>`,
        )
        .join('\n            ');

      return `
        <div class="element element-list" style="${style}">
          <ul style="list-style: none; padding-left: 0; margin: 0;">
            ${listItems}
          </ul>
        </div>`;
    }

    case 'image': {
      if (!element.imageUrl) return '';
      return `
        <div class="element element-image" style="${style}">
          <img 
            src="${escapeHtml(element.imageUrl)}" 
            alt="${escapeHtml(element.alt || '')}" 
            style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);"
          />
        </div>`;
    }

    default:
      return '';
  }
}

/**
 * 渲染背景样式
 */
function renderBackground(slide: Slide, theme: Theme): string {
  if (!slide.background) {
    return `background: ${theme.colors.background};`;
  }

  const bg = slide.background;

  if (bg.type === 'color' && bg.color) {
    return `background: ${bg.color};`;
  }

  if (bg.type === 'gradient' && bg.gradient) {
    const { direction, stops, angle } = bg.gradient;
    if (direction === 'linear') {
      const angleDeg = angle || 135;
      const stopStr = stops.map(s => `${s.color} ${s.offset}%`).join(', ');
      return `background: linear-gradient(${angleDeg}deg, ${stopStr});`;
    } else {
      const stopStr = stops.map(s => `${s.color} ${s.offset}%`).join(', ');
      return `background: radial-gradient(circle, ${stopStr});`;
    }
  }

  if (bg.type === 'image' && bg.imageUrl) {
    return `background-image: url(${escapeHtml(bg.imageUrl)}); background-size: cover; background-position: center;`;
  }

  return `background: ${theme.colors.background};`;
}

/**
 * 渲染单个幻灯片
 */
function renderSlide(slide: Slide, theme: Theme, isActive: boolean): string {
  const activeClass = isActive ? 'active' : '';
  const backgroundStyle = renderBackground(slide, theme);

  const elementsHtml = slide.elements.map(element => renderElement(element, theme)).join('\n      ');

  return `
    <div class="slide ${activeClass}" style="${backgroundStyle}">
      <div class="slide-content">
        ${elementsHtml}
      </div>
    </div>`;
}

/**
 * 生成完整的 HTML 内容
 */
export function generateHtmlContent(data: PresentationData): string {
  const { metadata, theme, slides } = data;
  const title = escapeHtml(metadata.title);

  const slidesHtml = slides.map((slide, index) => renderSlide(slide, theme, index === 0)).join('');

  // 生成主题 CSS
  const themeCss = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: ${theme.typography.fontFamily};
      background: ${theme.colors.background};
      color: ${theme.colors.text};
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
      padding: ${theme.spacing.slidePadding}px;
      overflow-y: auto;
      position: relative;
    }

    .slide.active {
      display: flex;
      flex-direction: column;
    }

    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .element {
      position: absolute;
    }

    .element-heading h2 {
      line-height: 1.2;
    }

    .element-text p {
      word-wrap: break-word;
    }

    .element-list ul {
      list-style: none;
    }

    .element-list li:before {
      content: '•';
      color: ${theme.colors.accent};
      font-size: 1.2em;
      margin-right: 8px;
    }

    .element-image img {
      display: block;
    }

    .slide-number {
      position: fixed;
      top: 20px;
      left: 20px;
      background: ${theme.colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      color: ${theme.colors.textSecondary};
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

      .element-heading h2 {
        font-size: 32px !important;
      }

      .element-text p,
      .element-list li {
        font-size: 18px !important;
      }
    }
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    ${themeCss}
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
