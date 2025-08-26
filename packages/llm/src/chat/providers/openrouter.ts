import { z } from 'zod';
import { BaseProvider, ProviderModelInfo } from './base';
import { providerConfigSchemas } from '../schema';

const configSchema = providerConfigSchemas.openrouter.schema;

export class OpenRouterProvider extends BaseProvider<z.infer<typeof configSchema>> {
  readonly provider = 'openrouter';
  readonly displayName = 'OpenRouter';
  readonly baseUrl = 'https://openrouter.ai/api/v1';
  readonly apiKeyPlaceholder = 'sk-...';
  readonly homepage = 'https://openrouter.ai/';

  protected config: z.infer<typeof configSchema> = {
    baseUrl: this.baseUrl,
    apiKey: '',
  };

  async getModels(): Promise<ProviderModelInfo[]> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'force-cache',
    });

    if (response.ok) {
      const data = await response.json();
      return data.data.map((model: any) => ({
        id: model.id,
        provider: this.provider,
        name: model.name,
        description: model.description,
        contextLength: model.context_length,
        supportedParameters: model.supported_parameters,
        architecture: {
          inputModalities: model.input_modalities,
          outputModalities: model.output_modalities,
          tokenizer: model.tokenizer,
          instructType: model.instruct_type,
        },
        pricingDescription: `
| Prompt Input | Output |
|-------------------|---------------------|
| $${(Number(model.pricing.prompt) * 1000000).toFixed(2)}/M | $${(Number(model.pricing.completion) * 1000000).toFixed(2)}/M |
        `,
      }));
    }

    return [];
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        // Validate if returned data matches OpenAI API format
        if (data.data && Array.isArray(data.data)) {
          return { success: true };
        } else {
          return { success: false, error: 'Invalid response format, may not be a valid OpenAI API endpoint' };
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
