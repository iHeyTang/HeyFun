import { ModelInstructType } from '../types';

/**
 * Provider Base Class - Defines common interfaces and methods for all LLM providers
 */
export abstract class BaseProvider<TConfig = any> {
  /**
   * Provider identifier, each provider has a unique identifier, each provider has its own config schema.
   */
  abstract readonly provider: string;

  /**
   * Provider display name
   */
  abstract readonly displayName: string;
  /**
   * Provider base URL, it is used to test connection and format request.
   */
  abstract readonly baseUrl: string;
  /**
   * API key placeholder, it is used to display in the UI.
   */
  abstract readonly apiKeyPlaceholder?: string;
  /**
   * Homepage URL
   */
  abstract readonly homepage: string;

  /**
   * Abstract member: Current configuration
   */
  protected abstract config: TConfig;

  /**
   * Set configuration, for adjusting the configuration temporarily.
   */
  setConfig(config: TConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TConfig {
    return this.config;
  }

  /**
   * Get supported model list
   */
  abstract getModels(): Promise<ProviderModelInfo[]>;


  /**
   * Test connection (can be overridden)
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Default implementation: send a simple test request
      const configObj = this.config as any;
      const response = await fetch(`${configObj.baseUrl}/models`, {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET'
      });

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }
}


// Add BaseModel type definition and export at the end of the file
export interface ProviderModelInfo {
  id: string;
  provider: string;
  name: string;
  createdAt: Date;
  description: string;
  architecture: {
    inputModalities: string[];
    outputModalities: string[];
    tokenizer: string;
    instructType: ModelInstructType;
  }
  pricingDescription: string;
  contextLength: number;
  supportedParameters: string[];
}
