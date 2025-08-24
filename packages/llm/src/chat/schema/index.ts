import { BuiltinProviderConfigSchema } from './builtin';
import { DeepseekProviderConfigSchema } from './deepseek';
import { OpenRouterProviderConfigSchema } from './openrouter';

export const providerConfigSchemas = {
  builtin: new BuiltinProviderConfigSchema(),
  deepseek: new DeepseekProviderConfigSchema(),
  openrouter: new OpenRouterProviderConfigSchema(),
};
