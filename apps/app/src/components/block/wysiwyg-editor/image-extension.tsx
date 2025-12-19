import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
          };
        },
      },
      height: {
        default: 200, // 默认高度为 200px
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? parseInt(height, 10) : 200;
        },
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height,
          };
        },
      },
      'data-placeholder-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-placeholder-id'),
        renderHTML: attributes => {
          if (!attributes['data-placeholder-id']) {
            return {};
          }
          return {
            'data-placeholder-id': attributes['data-placeholder-id'],
          };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'image-wrapper relative inline-block max-w-full rounded transition-all';

      const img = document.createElement('img');
      const mergedAttrs = mergeAttributes(HTMLAttributes, this.options.HTMLAttributes || {});
      Object.entries(mergedAttrs).forEach(([key, value]) => {
        if (value !== null && value !== undefined && typeof value === 'string') {
          img.setAttribute(key, value);
        }
      });

      // 确保 src 属性被正确设置（从 node.attrs 中获取）
      // 使用完整的 URL，确保图片能正确加载
      if (node.attrs.src) {
        const srcUrl = String(node.attrs.src);
        // 只有当 src 不同时才设置，避免重复加载
        if (img.src !== srcUrl) {
          img.src = srcUrl;
        }
      }

      // 处理占位符样式
      const isPlaceholder = node.attrs['data-placeholder-id'];
      if (isPlaceholder) {
        img.style.opacity = '0.6';
      }

      img.className = 'rounded cursor-move block';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      img.style.marginTop = '0';
      img.style.marginBottom = '0';

      // 应用宽度和高度
      const height = node.attrs.height ?? 200; // 默认 200px
      const width = node.attrs.width;

      if (width) {
        img.style.width = typeof width === 'number' ? `${width}px` : String(width);
      }
      img.style.height = typeof height === 'number' ? `${height}px` : String(height);
      img.style.maxHeight = ''; // 清除 maxHeight，使用固定高度

      // 添加调整大小的控制点（不可见但可交互）
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'absolute bottom-0 right-0 w-3 h-3';
      resizeHandle.style.cursor = 'nwse-resize'; // 支持双向调整（放大和缩小）
      resizeHandle.style.opacity = '0';
      resizeHandle.style.visibility = '';
      // 保留 pointer-events，让控制点仍然可以交互
      resizeHandle.style.pointerEvents = 'auto';

      dom.appendChild(img);
      dom.appendChild(resizeHandle);
      dom.classList.add('group');

      // 图片加载完成后计算初始宽高比
      let aspectRatio: number | null = null;
      const updateAspectRatio = () => {
        if (img.naturalWidth && img.naturalHeight) {
          aspectRatio = img.naturalWidth / img.naturalHeight;
        }
      };

      // 设置图片加载事件（只设置一次，避免重复触发）
      let loadHandlerSet = false;
      const setupImageLoad = () => {
        if (loadHandlerSet) return;
        loadHandlerSet = true;

        img.onload = () => {
          updateAspectRatio();
          // 图片加载成功后，如果不是占位符，设置正常透明度
          // 注意：这里使用 img.src 来判断，而不是 node.attrs，因为 node 可能是闭包中的旧值
          if (!img.hasAttribute('data-placeholder-id')) {
            img.style.opacity = '1';
          }
        };

        img.onerror = (e: string | Event) => {
          // 图片加载失败时的处理
          const currentSrc = img.src;
          console.error('图片加载失败:', currentSrc);
          // 显示错误占位符，但不重复设置 src
          img.style.opacity = '0.3';
          img.alt = '图片加载失败';
          // 阻止事件冒泡，避免触发其他错误处理
          if (typeof e !== 'string' && e instanceof Event) {
            e.stopPropagation();
          }
        };
      };

      setupImageLoad();

      // 如果图片已经加载完成，立即计算宽高比
      if (img.complete && img.naturalWidth > 0) {
        updateAspectRatio();
      }

      // 移除选中状态的边框样式（不再显示选中边框）

      // 调整大小功能
      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      const onMouseDown = (e: MouseEvent) => {
        if (e.target === resizeHandle || (e.target === img && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          isResizing = true;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = img.offsetWidth;
          startHeight = img.offsetHeight;

          if (!aspectRatio && img.naturalWidth && img.naturalHeight) {
            aspectRatio = img.naturalWidth / img.naturalHeight;
          }

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // 使用较大的变化量来保持比例
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

        let newWidth = startWidth + delta;
        let newHeight = aspectRatio ? newWidth / aspectRatio : startHeight + deltaY;

        // 移除最大高度限制

        // 限制最小尺寸
        if (newWidth < 50) {
          newWidth = 50;
          newHeight = aspectRatio ? newWidth / aspectRatio : newHeight;
        }
        if (newHeight < 50) {
          newHeight = 50;
          newWidth = aspectRatio ? newHeight * aspectRatio : newWidth;
        }

        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
      };

      const onMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;

        const width = img.offsetWidth;
        const height = img.offsetHeight;

        const pos = getPos();
        if (typeof pos === 'number') {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width,
              height,
            });
            return true;
          });
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      dom.addEventListener('mousedown', onMouseDown);

      return {
        dom,
        contentDOM: null,
        update: updatedNode => {
          // 当节点更新时，同步更新图片
          if (updatedNode.type.name === 'image') {
            // 更新节点引用
            node = updatedNode;

            // 只有当 src 发生变化时才更新，避免重复加载
            const newSrc = updatedNode.attrs.src;
            if (newSrc && img.src !== newSrc) {
              img.src = newSrc;
            }

            // 更新占位符状态
            const isPlaceholder = updatedNode.attrs['data-placeholder-id'];
            if (isPlaceholder) {
              img.style.opacity = '0.6';
            } else {
              // 如果不是占位符，等待图片加载完成后再设置 opacity
              if (img.complete && img.naturalWidth > 0) {
                img.style.opacity = '1';
              }
              // 清除占位符相关属性
              if (img.hasAttribute('data-placeholder-id')) {
                img.removeAttribute('data-placeholder-id');
              }
            }

            // 更新尺寸
            const height = updatedNode.attrs.height ?? 200; // 默认 200px
            const width = updatedNode.attrs.width;

            if (width) {
              img.style.width = typeof width === 'number' ? `${width}px` : String(width);
            } else {
              img.style.width = '';
            }
            img.style.height = typeof height === 'number' ? `${height}px` : String(height);
            img.style.maxHeight = ''; // 清除 maxHeight，使用固定高度

            return true; // 返回 true 表示已处理更新
          }
          return false; // 返回 false 表示未处理
        },
      };
    };
  },
}).configure({
  inline: true,
  allowBase64: true, // 允许 base64 图片，用于显示上传占位符
});
