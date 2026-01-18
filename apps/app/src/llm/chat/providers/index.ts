import { BaseProvider, ProviderConfig } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import { DeepSeekProvider } from './deepseek';
import { VercelProvider } from './vercel';
import { VApiProvider } from './v-api';

export { BaseProvider } from './base';
export type { ProviderConfig } from './base';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { OpenRouterProvider } from './openrouter';
export { DeepSeekProvider } from './deepseek';
export { VercelProvider } from './vercel';

const providerClasses: Record<string, new (config?: ProviderConfig) => BaseProvider> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  openrouter: OpenRouterProvider,
  deepseek: DeepSeekProvider,
  vercel: VercelProvider,
  vapi: VApiProvider,
};

export function createProvider(providerId: string, config?: ProviderConfig): BaseProvider {
  const ProviderClass = providerClasses[providerId];
  if (!ProviderClass) throw new Error(`Unknown provider: ${providerId}`);
  return new ProviderClass(config);
}

export function getAvailableProviders(): string[] {
  return Object.keys(providerClasses);
}
