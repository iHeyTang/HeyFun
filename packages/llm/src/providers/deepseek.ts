import { z } from 'zod';
import { BaseProvider, ProviderModelInfo } from './base';
import { providerConfigSchemas } from '../schema';

const configSchema = providerConfigSchemas.deepseek.schema;

export class DeepseekProvider extends BaseProvider<z.infer<typeof configSchema>> {
  readonly provider = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly baseUrl = 'https://api.deepseek.com';
  readonly apiKeyPlaceholder = '...';
  readonly homepage = 'https://deepseek.com/';

  protected config: z.infer<typeof configSchema> = {
    baseUrl: this.baseUrl,
    apiKey: '',
  }


  async getModels(): Promise<ProviderModelInfo[]> {
    const defaultModels: ProviderModelInfo[] = [
      {
        id: 'deepseek-chat',
        provider: this.provider,
        name: 'DeepSeek Chat',
        createdAt: new Date(),
        description: 'DeepSeek Chat / DeepSeek V3',
        contextLength: 64000,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          tokenizer: 'gpt',
          instructType: 'openai',
        },
        pricingDescription: `
| 时段 | 输入价格 (缓存命中) | 输入价格 (缓存未命中) | 输出价格 |
|------|-------------------|---------------------|----------|
| 标准时段(北京时间 08:30-00:30) | 0.5 元/百万tokens | 2 元/百万tokens | 8 元/百万tokens |
| 优惠时段(北京时间 00:30-08:30) | 0.25 元/百万tokens | 1 元/百万tokens | 4 元/百万tokens |
`,
      },
      {
        id: 'deepseek-reasoner',
        provider: this.provider,
        name: 'DeepSeek Reasoner',
        createdAt: new Date(),
        description: 'DeepSeek Reasoner / DeepSeek R1',
        contextLength: 64000,
        supportedParameters: ['temperature', 'top_p', 'max_tokens'],
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          tokenizer: 'gpt',
          instructType: 'openai',
        },
        pricingDescription: `
| 时段 | 输入价格 (缓存命中) | 输入价格 (缓存未命中) | 输出价格 |
|------|-------------------|---------------------|----------|
| 标准时段(北京时间 08:30-00:30) | 1 元/百万tokens | 4 元/百万tokens | 16 元/百万tokens |
| 优惠时段(北京时间 00:30-08:30) | 0.25 元/百万tokens | 1 元/百万tokens | 4 元/百万tokens |
`,
      },
    ];
    return defaultModels;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return { success: true };
        } else {
          return { success: false, error: 'Invalid response format, may not be a valid DeepSeek API endpoint' };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
