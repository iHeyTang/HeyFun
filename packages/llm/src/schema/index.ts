import { DeepseekProviderConfigSchema } from './deepseek';
import { OpenRouterProviderConfigSchema } from './openrouter';

export const providerConfigSchemas = {
  deepseek: new DeepseekProviderConfigSchema(),
  openrouter: new OpenRouterProviderConfigSchema(),
};
