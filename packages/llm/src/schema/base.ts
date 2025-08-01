import { z } from 'zod';

export abstract class BaseProviderConfigSchema<TConfig = any> {
  abstract readonly schema: z.ZodSchema<TConfig>;
  abstract readonly maskSensitiveKeys: string[];
  abstract readonly defaultValues: TConfig;
}
