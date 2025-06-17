<p align="center">
  <img src="assets/logo.jpg" width="200"/>
</p>

中文 | [English](README-en.md)

# 🎉 HeyFun

Hey! Let's bring a little fun to this world together.

## 项目愿景

1. 通用领域全能 AI 助手，为 AI 时代的超级个体和一人公司提供最有力的支持
2. 专精领域 AI 智能体的快速开发验证，为垂类 AI Agent 提供最好的效率平台

## 项目演示

1. 通过 MCP 实现网络搜索和访问 Flomo 自动记录笔记
   https://www.heyfun.ai/share/tasks/cm9k3hmiv00ezo8011k4008qx

2. 通过 MCP 实现 MiniMax 的文字生成图像，进一步通过生成的图像来生成视频
   https://www.heyfun.ai/share/tasks/cmbnaws9y001xqr01e7miwpme

## 安装指南

该项目分为两个部分，分别是 Agent (根目录) 和 App (web/)

### HeyFun Agent

1. 安装 uv（一个快速的 Python 包管理器）：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. 克隆仓库：

```bash
git clone https://github.com/iHeyTang/HeyFun.git
cd HeyFun
```

3. 创建并激活虚拟环境：

```bash
uv venv --python 3.12
source .venv/bin/activate  # Unix/macOS 系统
# Windows 系统使用：
# .venv\Scripts\activate

# 安装成功后，会有以下提示，可以选择重开Terminal 或 按照以下提示进行操作
#To add $HOME/.local/bin to your PATH, either restart your shell or run:
#    source $HOME/.local/bin/env (sh, bash, zsh)
#    source $HOME/.local/bin/env.fish (fish)

# 验证 uv 安装成功
uv --version
# 输出以下版本号则表示安装成功
# uv 0.6.14 (a4cec56dc 2025-04-09)
```

4. 安装依赖：

````bash
uv pip install -r requirements.txt

### 安装浏览器自动化工具 playwright
```bash
playwright install
````

5. 安装 Docker 环境，windows 推荐 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，MacOS 或 Linux 推荐 [Orbstack](https://orbstack.dev/download)

### HeyFun Web

1. 安装 `node` 环境

   方式 1: [推荐] 使用 nvm 包管理器 https://github.com/nvm-sh/nvm
   方式 2: 前往官方下载 https://nodejs.org/en
   方式 3: (Windows 系统) 使用 nvm 包管理器 https://github.com/coreybutler/nvm-windows/releases/tag/1.2.2

```bash
# 按照流程安装完毕后，通过命令确认安装成功
node -v
# 输出版本号表示安装成功
# v20.19.0
```

2. 进入 `web/` 文件夹

```bash
# 如果已经在 web 目录下忽略即可
cd web
```

3. 安装项目依赖

```bash
# 安装项目依赖
npm install
```

4. 生成密钥对

项目需要一对公钥和私钥用于认证，可以通过以下命令生成（有自行生成证书能力的忽略即可）：

```bash
npm run generate-keys

# 这将在 `web/keys` 目录生成：
# - `private.pem`: 私钥文件
# - `public.pem`: 公钥文件
```

5. 数据库初始化

项目使用 PostgreSQL 作为持久化数据库。可使用 [Docker 容器](https://hub.docker.com/_/postgres) 来启动数据库服务

```bash
# 启动 docker 容器 并自动创建 名为 heyfun 的数据库
docker run --name heyfun-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=heyfun -d -p 5432:5432 postgres
```

6. 环境变量配置

在项目根目录创建 `.env` 文件，配置必要的环境变量，具体参考 `/web/.env.example`

```bash
# 若按照 步骤 5 配置数据库，则数据库连接为
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/heyfun?schema=public"
```

7. 生成 Prisma 客户端 & 初始化数据库

```bash
# 若第一次启动项目、重新安装了依赖、schema.prisma 存在更新，需执行此命令更新 Prisma Client
npx prisma generate

# 若第一次启动项目，需要先初始化数据库，此命令会自动将表结构同步进相应配置的数据库中
npx prisma db push
```

## 快速启动

```bash
# HeyFun Agent 使用 run_api.py 启动
python run_api.py
```

```bash
# HeyFun Web 需要进入 web/ 目录， 使用 npm run dev 启动
cd web
npm run dev
```

启动完毕后，打开 `http://localhost:3000` 即可查看

## MCP 工具配置

当自行部署时，Tools Market 是没有初始化数据的。向市场添加工具的交互页面暂时没有完全实现，若需要引入 MCP 工具，有两种方式：

1. 可以使用 Custom Tool，在输入配置窗口中自行配置 MCP 工具。
2. 可以参考 `scripts/init_tool_schemas.sql`，将对应数据直接插入数据库中。

## 致谢

本项目灵感源自 [OpenManus](https://github.com/FoundationAgents/OpenManus) First Hackathon。在 OpenManus 的极客社区中，我不仅获得了前沿的技术交流机会，更在开源协作与创新氛围中收获了宝贵的成长。正是 OpenManus 提供的开放平台和技术支持，让 HeyFun 得以从想法落地为现实。在此，衷心感谢 OpenManus 及其社区对我的启发与帮助，愿我们共同推动 AI 技术的极客探索与无限可能！
