window['html-viewer'] = {
  async render(context) {
    const { fileContent, container, api } = context;

    try {
      api.showLoading();

      // 清空容器并添加HTML结构
      container.innerHTML = `
        <div class="html-viewer">
          <div class="viewer-header">
            <div class="view-mode-tabs">
              <button class="tab-button active" data-mode="preview">Preview</button>
              <button class="tab-button" data-mode="source">Source</button>
            </div>
          </div>
          <div class="viewer-content">
            <div id="preview-mode" class="view-mode active"></div>
            <div id="source-mode" class="view-mode"></div>
          </div>
        </div>
      `;

      // 获取模式容器
      const previewMode = container.querySelector('#preview-mode');
      const sourceMode = container.querySelector('#source-mode');
      const tabButtons = container.querySelectorAll('.tab-button');

      // 设置源码内容
      sourceMode.innerHTML = `
        <div class="source-code-container">
          <pre><code class="html-source">${this.escapeHtml(fileContent)}</code></pre>
        </div>
      `;

      // 设置预览内容
      previewMode.innerHTML = `
        <div class="preview-container">
          <iframe 
            id="html-preview-frame" 
            class="html-preview-frame"
            sandbox="allow-scripts allow-same-origin"
            title="HTML Preview">
          </iframe>
        </div>
      `;

      // 加载预览内容到iframe
      const iframe = previewMode.querySelector('#html-preview-frame');
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(fileContent);
          iframeDoc.close();
        } catch (error) {
          console.warn('Failed to load content in iframe:', error);
          // 如果iframe加载失败，显示错误信息
          previewMode.innerHTML = `
            <div class="preview-container">
              <div class="preview-error">
                <p>无法在iframe中预览HTML内容，可能是由于安全限制。</p>
                <p>请查看源码模式。</p>
              </div>
            </div>
          `;
        }
      }

      // 添加标签切换事件
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const mode = button.getAttribute('data-mode');
          this.switchMode(container, mode);
        });
      });

      // 添加语法高亮
      this.addSyntaxHighlighting(sourceMode);
    } catch (error) {
      console.error('HTML viewer error:', error);
      api.showError('解析HTML文件失败');
    } finally {
      api.hideLoading();
    }
  },

  switchMode(container, mode) {
    // 更新标签按钮状态
    const tabButtons = container.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-mode') === mode);
    });

    // 更新内容区域
    const previewMode = container.querySelector('#preview-mode');
    const sourceMode = container.querySelector('#source-mode');

    if (mode === 'preview') {
      previewMode.classList.add('active');
      sourceMode.classList.remove('active');
    } else {
      sourceMode.classList.add('active');
      previewMode.classList.remove('active');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  addSyntaxHighlighting(container) {
    // 简单的语法高亮实现
    const codeElement = container.querySelector('.html-source');
    if (codeElement) {
      let code = codeElement.textContent;

      // 基本的HTML语法高亮
      code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      codeElement.innerHTML = code;
    }
  },
};
