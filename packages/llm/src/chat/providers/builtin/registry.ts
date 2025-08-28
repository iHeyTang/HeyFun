import { ModelDefinition, ServiceAdapter, ModelRegistry } from './types';

/**
 * 模型注册表实现
 */
export class BuiltinModelRegistry implements ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map();
  private adapters: Map<string, ServiceAdapter> = new Map();

  constructor() {
    this.initializeDefaultAdapters();
    this.initializeDefaultModels();
  }

  getModel(modelId: string): ModelDefinition | null {
    return this.models.get(modelId) || null;
  }

  getAvailableModels(): ModelDefinition[] {
    const availableModels: ModelDefinition[] = [];

    for (const model of this.models.values()) {
      // 检查是否有可用的服务商
      const bestProvider = this.getBestProvider(model.id);
      if (bestProvider) {
        availableModels.push(model);
      }
    }

    return availableModels;
  }

  getBestProvider(modelId: string): { adapter: ServiceAdapter; config: any } | null {
    const model = this.getModel(modelId);
    if (!model) return null;

    // 按优先级排序，选择第一个可用的服务商
    const sortedProviders = [...model.providers].sort((a, b) => a.priority - b.priority);

    for (const providerConfig of sortedProviders) {
      const adapter = this.adapters.get(providerConfig.id);
      if (adapter && this.isAdapterAvailable(adapter)) {
        return { adapter, config: providerConfig };
      }
    }

    return null;
  }

  registerModel(model: ModelDefinition): void {
    this.models.set(model.id, model);
  }

  registerAdapter(adapter: ServiceAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * 检查适配器是否可用（API密钥已配置）
   */
  private isAdapterAvailable(adapter: ServiceAdapter): boolean {
    return !!process.env[adapter.env.apiKey];
  }

  /**
   * 初始化默认服务商适配器
   */
  private initializeDefaultAdapters(): void {
    const adapters: ServiceAdapter[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com',
        authMethod: 'bearer',
        env: {
          apiKey: 'OPENAI_API_KEY',
          baseUrl: 'OPENAI_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/v1/chat/completions',
          streamingSupported: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
        authMethod: 'api-key',
        env: {
          apiKey: 'ANTHROPIC_API_KEY',
          baseUrl: 'ANTHROPIC_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/v1/messages',
          streamingSupported: true,
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          requestTransform: 'anthropicRequestTransform',
          responseTransform: 'anthropicResponseTransform',
        },
      },
      {
        id: 'google',
        name: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        authMethod: 'api-key',
        env: {
          apiKey: 'GOOGLE_API_KEY',
          baseUrl: 'GOOGLE_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/v1beta/models/{model}:generateContent',
          streamingSupported: true,
          requestTransform: 'googleRequestTransform',
          responseTransform: 'googleResponseTransform',
        },
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai',
        authMethod: 'bearer',
        env: {
          apiKey: 'OPENROUTER_API_KEY',
          baseUrl: 'OPENROUTER_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/api/v1/chat/completions',
          streamingSupported: true,
          headers: {
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://heyfun.ai',
            'X-Title': 'HeyFun AI',
          },
        },
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        authMethod: 'bearer',
        env: {
          apiKey: 'DEEPSEEK_API_KEY',
          baseUrl: 'DEEPSEEK_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/v1/chat/completions',
          streamingSupported: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
      {
        id: 'siliconflow',
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn',
        authMethod: 'bearer',
        env: {
          apiKey: 'SILICONFLOW_API_KEY',
          baseUrl: 'SILICONFLOW_BASE_URL',
        },
        apiConfig: {
          chatCompletionEndpoint: '/v1/chat/completions',
          streamingSupported: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
    ];

    adapters.forEach(adapter => this.registerAdapter(adapter));
  }

  /**
   * 初始化默认模型定义
   */
  private initializeDefaultModels(): void {
    const models: ModelDefinition[] = [
      {
        id: 'deepseek-chat:free',
        name: 'DeepSeek Chat(Free)',
        description: 'DeepSeek Chat / DeepSeek V3',
        family: 'deepseek',
        contextLength: 64000,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        instructType: 'openai',
        providers: [
          { id: 'openrouter', modelId: 'deepseek/deepseek-chat-v3-0324:free', priority: 1, pricing: { input: 0, output: 0, currency: 'USD' } },
        ],
      },
      {
        id: 'deepseek-reasoner:free',
        name: 'DeepSeek Reasoner(Free)',
        description: 'DeepSeek Reasoner / DeepSeek V3',
        family: 'deepseek',
        contextLength: 64000,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        instructType: 'openai',
        providers: [{ id: 'openrouter', modelId: 'deepseek/deepseek-r1-0528:free', priority: 1, pricing: { input: 0, output: 0, currency: 'USD' } }],
      },
      {
        id: 'qwen/qwen3-235b-a22b:free',
        name: 'Qwen3 235B A22B (free)',
        description: "Alibaba's latest flagship model with strong reasoning capabilities",
        family: 'qwen',
        contextLength: 32768,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        instructType: 'openai',
        providers: [{ id: 'openrouter', modelId: 'qwen/qwen3-235b-a22b:free', priority: 1, pricing: { input: 0, output: 0, currency: 'USD' } }],
      },
      {
        id: 'qwen/qwen3-235b-a22b',
        name: 'Qwen3 235B A22B',
        description: "Alibaba's latest flagship model with strong reasoning capabilities",
        family: 'qwen',
        contextLength: 32768,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        instructType: 'openai',
        providers: [
          { id: 'openrouter', modelId: 'qwen/qwen3-235b-a22b-2507', priority: 1, pricing: { input: 0.078, output: 0.312, currency: 'USD' } },
        ],
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description:
          'Gemini 2.5 Flash-Lite is a lightweight reasoning model in the Gemini 2.5 family, optimized for ultra-low latency and cost efficiency. It offers improved throughput, faster token generation, and better performance across common benchmarks compared to earlier Flash models. By default, "thinking" (i.e. multi-pass reasoning) is disabled to prioritize speed, but developers can enable it via the Reasoning API parameter to selectively trade off cost for intelligence.',
        family: 'gemini',
        contextLength: 1048576,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        instructType: 'google',
        providers: [
          { id: 'openrouter', modelId: 'google/gemini-2.5-flash-lite', priority: 1, pricing: { input: 0.1, output: 0.4, currency: 'USD' } },
        ],
      },
    ];

    models.forEach(model => this.registerModel(model));
  }

  /**
   * 从配置文件加载模型定义（扩展点）
   */
  loadModelsFromConfig(configPath: string): void {
    // 未来可以从外部配置文件加载模型定义
    // 这样用户可以无需修改代码就添加新模型
  }

  /**
   * 获取所有可用的适配器
   */
  getAvailableAdapters(): ServiceAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => this.isAdapterAvailable(adapter));
  }
}
