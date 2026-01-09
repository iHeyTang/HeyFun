import { BaseAdapter } from './base';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';

export { BaseAdapter } from './base';
export { OpenAIAdapter } from './openai';
export { AnthropicAdapter } from './anthropic';
export { GoogleAdapter } from './google';

const adapterInstances: Record<string, BaseAdapter> = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GoogleAdapter(),
};

export function getAdapter(protocol: string): BaseAdapter {
  const adapter = adapterInstances[protocol];
  if (!adapter) throw new Error(`Unknown adapter protocol: ${protocol}`);
  return adapter;
}

export function getAvailableAdapters(): string[] {
  return Object.keys(adapterInstances);
}
