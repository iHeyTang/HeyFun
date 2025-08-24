import { z } from 'zod';
import { BaseProvider, ProviderModelInfo } from './base';
import { providerConfigSchemas } from '../schema';
import { BuiltinModelRegistry } from './builtin/registry';
import { UniversalApiAdapter } from './builtin/adapters';

const configSchema = providerConfigSchemas.builtin.schema;

export class BuiltinProvider extends BaseProvider<z.infer<typeof configSchema>> {
  readonly provider = 'builtin';
  readonly displayName = 'HeyFun';
  readonly baseUrl = '';
  readonly apiKeyPlaceholder = '';
  readonly homepage = 'https://heyfun.ai';

  protected config: z.infer<typeof configSchema> = {};

  private registry: BuiltinModelRegistry;

  constructor() {
    super();
    this.registry = new BuiltinModelRegistry();
  }

  async getModels(): Promise<ProviderModelInfo[]> {
    const availableModels = this.registry.getAvailableModels();

    return availableModels.map(modelDef => {
      const bestProvider = this.registry.getBestProvider(modelDef.id);

      return {
        id: modelDef.id,
        provider: this.provider,
        name: modelDef.name,
        createdAt: new Date(),
        description: `${modelDef.description} (via ${bestProvider?.adapter.name || 'Unknown'})`,
        contextLength: modelDef.contextLength,
        supportedParameters: modelDef.supportedParameters,
        architecture: {
          inputModalities: modelDef.inputModalities,
          outputModalities: modelDef.outputModalities,
          tokenizer: modelDef.instructType === 'anthropic' ? 'claude' : 'gpt',
          instructType: 'universal', // 所有builtin模型都使用universal指令类型
        },
        pricingDescription: this.formatPricingDescription(bestProvider?.config),
      };
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const availableAdapters = this.registry.getAvailableAdapters();

      if (availableAdapters.length === 0) {
        const supportedEnvVars = [
          'OPENAI_API_KEY',
          'ANTHROPIC_API_KEY',
          'GOOGLE_API_KEY',
          'OPENROUTER_API_KEY',
          'DEEPSEEK_API_KEY',
          'SILICONFLOW_API_KEY',
        ];
        return {
          success: false,
          error: `No API keys configured. Please set at least one of: ${supportedEnvVars.join(', ')}`,
        };
      }

      // 测试第一个可用的适配器
      const firstAdapter = availableAdapters[0];
      return await this.testAdapterConnection(firstAdapter);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * 测试特定适配器的连接
   */
  private async testAdapterConnection(adapter: any): Promise<{ success: boolean; error?: string }> {
    try {
      // 简单的连接测试 - 根据不同服务商调用不同的测试端点
      const baseUrl = process.env[adapter.env.baseUrl] || adapter.baseUrl;
      const apiKey = process.env[adapter.env.apiKey];

      let testUrl = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      switch (adapter.id) {
        case 'openai':
        case 'openrouter':
        case 'deepseek':
        case 'siliconflow':
          testUrl = `${baseUrl}/v1/models`;
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'anthropic':
          testUrl = `${baseUrl}/v1/messages`;
          headers['x-api-key'] = apiKey!;
          headers['anthropic-version'] = '2023-06-01';
          // 对于Anthropic发送测试请求
          const response = await fetch(testUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
          });
          return { success: response.status === 200 || response.status === 400 };
        case 'google':
          testUrl = `${baseUrl}/v1beta/models?key=${apiKey}`;
          break;
        default:
          return { success: false, error: `Unknown adapter: ${adapter.id}` };
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
      });

      return {
        success: response.ok || response.status === 401, // 401表示认证失败但API可达
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * 格式化价格描述
   */
  private formatPricingDescription(providerConfig?: any): string {
    if (!providerConfig?.pricing) {
      return 'Pricing varies by provider. Check the official documentation.';
    }

    const { input, output, currency } = providerConfig.pricing;
    return `Input: $${input}/${currency === 'USD' ? '1M tokens' : 'tokens'} | Output: $${output}/${currency === 'USD' ? '1M tokens' : 'tokens'}`;
  }

  /**
   * 获取模型注册表（用于外部扩展）
   */
  getRegistry(): BuiltinModelRegistry {
    return this.registry;
  }

  /**
   * 创建指定模型的API适配器
   */
  createModelAdapter(modelId: string): UniversalApiAdapter | null {
    const bestProvider = this.registry.getBestProvider(modelId);
    if (!bestProvider) {
      return null;
    }

    return new UniversalApiAdapter(bestProvider.adapter, bestProvider.config);
  }

  /**
   * 获取模型的实际配置信息（用于LLMClient）
   */
  getModelRuntimeConfig(modelId: string): { apiKey: string; baseUrl: string; adapterType: string } | null {
    const bestProvider = this.registry.getBestProvider(modelId);
    if (!bestProvider) {
      return null;
    }

    const { adapter, config } = bestProvider;
    const baseUrl = process.env[adapter.env.baseUrl!] || adapter.baseUrl;
    const apiKey = process.env[adapter.env.apiKey];

    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      baseUrl,
      adapterType: adapter.id,
    };
  }

  /**
   * 扩展方法：动态添加新模型
   */
  addModel(modelDefinition: any): void {
    this.registry.registerModel(modelDefinition);
  }

  /**
   * 扩展方法：动态添加新服务商适配器
   */
  addServiceAdapter(adapter: any): void {
    this.registry.registerAdapter(adapter);
  }
}
