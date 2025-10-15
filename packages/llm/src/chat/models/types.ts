export interface ModelPricing {
  input: number;
  output: number;
  currency: string;
}

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  audio: boolean;
  [key: string]: boolean;
}

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  providerId: string;
  providerModelId: string;
  adapterType: string;
  contextLength: number;
  capabilities: ModelCapabilities;
  inputModalities: string[];
  outputModalities: string[];
  pricing: ModelPricing;
  supportedParameters: string[];
  defaultParameters?: Record<string, any>;
  family?: string;
  version?: string;
  releaseDate?: string;
  deprecated?: boolean;
  tags?: string[];
}

export interface ModelFilter {
  providerId?: string;
  family?: string;
  capabilities?: Partial<ModelCapabilities>;
  tags?: string[];
  maxPrice?: number;
  minContextLength?: number;
}

