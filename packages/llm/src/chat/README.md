# Chat 模块 - 三层解耦架构

## 快速开始

```typescript
import CHAT from '@repo/llm/chat';

// 创建客户端
const client = CHAT.createClient('gpt-4o-mini');

// 发送请求
const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## 架构设计

### 三层解耦

```
Client (用户接口)
  ↓
Model (配置层)
  ├→ Provider (提供商：鉴权、HTTP)
  └→ Adapter (协议：格式转换)
```

### 核心思想

- **Provider**: 只关心鉴权和 HTTP 请求，不关心协议格式
- **Adapter**: 只关心协议转换，不关心鉴权和HTTP
- **Model**: 配置使用哪个 Provider 和 Adapter，以及定价、能力等元信息

### 优势

1. **易于扩展**: 新增模型只需添加配置
2. **复用性高**: 多个模型可以共享 Provider 和 Adapter
3. **维护简单**: 修改定价、描述只需改配置
4. **用户友好**: 统一接口，无需关心底层实现

## 目录结构

```
chat/
├── providers/          # Provider 层
│   ├── base.ts        # 基类
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── openrouter.ts
│   ├── deepseek.ts
│   └── index.ts
├── adapters/          # Adapter 层
│   ├── base.ts        # 基类
│   ├── openai.ts      # OpenAI 协议
│   ├── anthropic.ts   # Anthropic 协议
│   ├── google.ts      # Google 协议
│   └── index.ts
├── models/            # Model 配置层
│   ├── types.ts       # 类型定义
│   ├── definitions.ts # 模型配置（核心！）
│   ├── registry.ts    # 注册表
│   └── index.ts
├── client.ts          # 统一客户端
├── types.ts           # 统一类型
├── index.ts           # 主入口
├── ARCHITECTURE.md    # 架构文档
├── USAGE.md           # 使用指南
└── README.md          # 本文件
```

## 添加新模型

只需在 `models/definitions.ts` 中添加配置：

```typescript
{
  id: 'my-new-model',
  name: 'My New Model',
  description: '新模型描述',
  providerId: 'openai',          // 使用 OpenAI Provider
  providerModelId: 'gpt-4',      // 在 OpenAI 中的模型 ID
  adapterType: 'openai',         // 使用 OpenAI 协议
  contextLength: 128000,
  capabilities: {
    streaming: true,
    tools: true,
    vision: false,
    audio: false,
  },
  inputModalities: ['text'],
  outputModalities: ['text'],
  pricing: {
    input: 1.0,
    output: 2.0,
    currency: 'USD',
  },
  supportedParameters: ['temperature', 'top_p', 'max_tokens'],
  family: 'gpt',
  tags: ['custom'],
}
```

## 添加新 Provider

1. 在 `providers/` 创建新文件
2. 继承 `BaseProvider`
3. 实现 `buildAuthHeaders` 方法

```typescript
export class MyProvider extends BaseProvider {
  readonly id = 'myprovider';
  readonly name = 'My Provider';
  readonly baseURL = 'https://api.myprovider.com/v1';

  buildAuthHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.config.apiKey;
    if (!key) throw new Error('API key required');
    return { Authorization: `Bearer ${key}` };
  }
}
```

4. 在 `providers/index.ts` 中注册

## 添加新 Adapter

1. 在 `adapters/` 创建新文件
2. 继承 `BaseAdapter`
3. 实现格式转换方法

```typescript
export class MyAdapter extends BaseAdapter {
  readonly protocol = 'myprotocol';
  readonly name = 'My Protocol';

  formatRequest(params, modelId) {
    // 将统一格式转换为该协议格式
  }

  parseResponse(response, modelId) {
    // 将响应转换为统一格式
  }

  // ... 其他方法
}
```

4. 在 `adapters/index.ts` 中注册

## 环境变量

```bash
# 在 .env 中配置
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
DEEPSEEK_API_KEY=sk-...
GOOGLE_API_KEY=...
```

## 更多文档

- **架构设计**: 查看 `ARCHITECTURE.md`
- **详细使用**: 查看 `USAGE.md`
- **迁移记录**: 查看 `../MIGRATION_COMPLETE.md`

