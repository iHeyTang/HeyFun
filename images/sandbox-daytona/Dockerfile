FROM daytonaio/sandbox:0.4.3

# 切换到 root 用户以安装系统包
USER root

# 安装系统依赖（Chromium 需要）
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
RUN pip3 install --no-cache-dir playwright requests

# 安装 Playwright 浏览器（Chromium）
RUN python3 -m playwright install chromium

# 安装 Playwright 系统依赖（确保浏览器能正常运行）
RUN python3 -m playwright install-deps chromium
