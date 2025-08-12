import { ProviderModelInfo } from './base';
import { DeepseekProvider } from './deepseek';
import { OpenRouterProvider } from './openrouter';

export type Provider = OpenRouterProvider | DeepseekProvider;
export type { ProviderModelInfo as ProviderModel };

/**
 * Provider Registry - Register all available providers here
 */
const providerClasses = {
  openrouter: OpenRouterProvider,
  deepseek: DeepseekProvider
} as const;

/**
 * Get all registered provider instances
 */
export function getAllProviders(): Record<string, Provider> {
  const providers: Record<string, Provider> = {};

  Object.keys(providerClasses).forEach(providerId => {
    const provider = getProvider(providerId);
    if (provider) {
      providers[providerId] = provider;
    }
  });

  return providers;
}

/**
 * Get provider instance
 */
export function getProvider(providerId: string): Provider | null {
  const ProviderClass = providerClasses[providerId as keyof typeof providerClasses];
  if (!ProviderClass) {
    console.warn(`Unknown provider: ${providerId}`);
    return null;
  }
  return new ProviderClass();
}

