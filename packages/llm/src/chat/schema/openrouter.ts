import { BaseProviderConfigSchema } from './base';
import { z } from 'zod';

const configSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export class OpenRouterProviderConfigSchema extends BaseProviderConfigSchema {
  readonly schema = configSchema;
  readonly maskSensitiveKeys = ['apiKey'];
  readonly defaultValues = {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
  };
}
